import {APIError, logger} from "@terreno/api";
import {DateTime} from "luxon";

import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "./adapters/console";
import {CommsMessage} from "./models/commsMessage";
import {PushToken} from "./models/pushToken";
import type {CommsMessageDocument} from "./modelTypes";
import type {
  CheckVerificationOptions,
  CommsAttempt,
  CommsChannel,
  CommsHookContext,
  CommsHookMessage,
  CommsOptions,
  DeliveryEvent,
  MailMessage,
  MailProvider,
  OptOutEvent,
  PushMessage,
  PushProvider,
  SendPushToUserMessage,
  SendResult,
  SmsMessage,
  SmsProvider,
  StartVerificationOptions,
  VerificationProvider,
  VerificationResult,
} from "./types";

const CHANNEL_NOT_CONFIGURED_TITLE = "Comms channel not configured";
const REDACTED_RECIPIENT = "[redacted]";

const throwUnconfiguredChannel = (): never => {
  throw new APIError({status: 501, title: CHANNEL_NOT_CONFIGURED_TITLE});
};

const isProduction = (): boolean => process.env.NODE_ENV === "production";

const providerErrorResult = (error: unknown): SendResult => ({
  accepted: false,
  error: error instanceof Error ? error.message : "Provider send failed",
  errorClass: "transient",
  errorCode: "provider-throw",
});

const isTransientFailure = (result: SendResult): boolean =>
  !result.accepted && result.errorClass === "transient";

const isPermanentTokenFailure = (result: SendResult): boolean =>
  Boolean(result.errorClass === "permanent" || result.isPermanentFailure);

const toAttempt = (provider: string, result: SendResult): CommsAttempt => ({
  at: DateTime.utc().toJSDate(),
  error: result.error,
  errorClass: result.errorClass,
  errorCode: result.errorCode,
  provider,
  providerMessageId: result.providerMessageId,
});

const DEFAULT_RETAIN_PAYLOAD_DAYS = 30;

export class CommsService {
  private readonly options: CommsOptions;
  private readonly consoleMail = new ConsoleMailProvider();
  private readonly consolePush = new ConsolePushProvider();
  private readonly consoleSms = new ConsoleSmsProvider();
  private readonly consoleVerification = new ConsoleVerificationProvider();

  constructor(options?: CommsOptions) {
    this.options = options ?? {};
  }

  private recipientForLog(recipient: string | string[]): string {
    if (this.options.redactRecipients !== false) {
      return REDACTED_RECIPIENT;
    }
    return Array.isArray(recipient) ? recipient.join(",") : recipient;
  }

  private async logResult({
    channel,
    metadata,
    payload,
    payloadExpiresAt,
    provider,
    result,
    subject,
    templateId,
    to,
    userId,
  }: {
    channel: CommsChannel;
    metadata?: Record<string, unknown>;
    payload?: unknown;
    payloadExpiresAt?: Date;
    provider: string;
    result: SendResult;
    subject?: string;
    templateId?: string;
    to: string | string[];
    userId?: string;
  }): Promise<CommsMessageDocument | null> {
    if (this.options.logMessages === false) {
      return null;
    }

    const attempt = toAttempt(provider, result);
    return CommsMessage.logSend({
      attemptCount: 1,
      attempts: [attempt],
      channel,
      error: result.error,
      errorClass: result.errorClass,
      errorCode: result.errorCode,
      lastAttemptAt: attempt.at,
      metadata: {...result.metadata, ...metadata},
      payload,
      payloadExpiresAt,
      provider,
      providerMessageId: result.providerMessageId,
      status: result.accepted ? "sent" : "failed",
      subject,
      templateId,
      to: this.recipientForLog(to),
      userId,
    });
  }

  private async logRetry({
    messageId,
    provider,
    result,
  }: {
    messageId?: string;
    provider: string;
    result: SendResult;
  }): Promise<void> {
    if (this.options.logMessages === false) {
      return;
    }
    await CommsMessage.appendAttempt({
      attempt: toAttempt(provider, result),
      error: result.error,
      errorClass: result.errorClass,
      errorCode: result.errorCode,
      messageId,
      providerMessageId: result.providerMessageId,
      status: result.accepted ? "sent" : "failed",
    });
  }

  private async invokeHook(hook: (() => Promise<void>) | undefined, label: string): Promise<void> {
    if (!hook) {
      return;
    }
    try {
      await hook();
    } catch (error: unknown) {
      logger.error(`[comms] ${label} hook failed: ${String(error)}`);
    }
  }

  private async runBeforeSend(
    context: CommsHookContext
  ): Promise<{cancel: boolean; message: CommsHookMessage | undefined}> {
    const original = context.message;
    const beforeSend = this.options.beforeSend;
    if (!beforeSend) {
      return {cancel: false, message: original};
    }
    try {
      const result = await beforeSend(context);
      if (result?.cancel) {
        return {cancel: true, message: result.message ?? original};
      }
      return {cancel: false, message: result?.message ?? original};
    } catch (error: unknown) {
      logger.error(`[comms] beforeSend hook failed: ${String(error)}`);
      return {cancel: false, message: original};
    }
  }

  private channelPayload(channel: CommsChannel, message: CommsHookMessage | undefined): unknown {
    if (!message) {
      return undefined;
    }
    if (channel === "mail") {
      const mail = message as MailMessage;
      return {
        dynamicTemplateData: mail.dynamicTemplateData,
        from: mail.from,
        html: mail.html,
        replyTo: mail.replyTo,
        subject: mail.subject,
        templateId: mail.templateId,
        text: mail.text,
        to: mail.to,
      };
    }
    if (channel === "sms") {
      const sms = message as SmsMessage;
      return {body: sms.body, to: sms.to};
    }
    if (channel === "push") {
      const push = message as PushMessage;
      return {
        badge: push.badge,
        body: push.body,
        data: push.data,
        sound: push.sound,
        title: push.title,
      };
    }
    const verification = message as StartVerificationOptions;
    return {channel: verification.channel};
  }

  private async retainedPayload(
    context: CommsHookContext,
    payload: unknown
  ): Promise<{payload?: unknown; payloadExpiresAt?: Date}> {
    const days = this.options.retainPayloadDays ?? DEFAULT_RETAIN_PAYLOAD_DAYS;
    if (days <= 0 || payload === undefined) {
      return {};
    }
    let stored: unknown = payload;
    const redactPayload = this.options.redactPayload;
    if (redactPayload) {
      try {
        stored = await redactPayload(context, payload);
      } catch (error: unknown) {
        logger.error(`[comms] redactPayload hook failed: ${String(error)}`);
      }
    }
    return {
      payload: stored,
      payloadExpiresAt: DateTime.utc().plus({days}).toJSDate(),
    };
  }

  private async logCancelled({
    channel,
    context,
    message,
    provider,
    subject,
    to,
    userId,
  }: {
    channel: CommsChannel;
    context: CommsHookContext;
    message: CommsHookMessage | undefined;
    provider: string;
    subject?: string;
    to: string | string[];
    userId?: string;
  }): Promise<SendResult> {
    const stored = await this.retainedPayload(context, this.channelPayload(channel, message));
    if (this.options.logMessages !== false) {
      await CommsMessage.logSend({
        attemptCount: 0,
        attempts: [],
        channel,
        payload: stored.payload,
        payloadExpiresAt: stored.payloadExpiresAt,
        provider,
        status: "cancelled",
        subject,
        to: this.recipientForLog(to),
        userId,
      });
    }
    return {accepted: false, error: "cancelled"};
  }

  private async notifyOutcomeHooks(context: CommsHookContext, result: SendResult): Promise<void> {
    if (result.accepted) {
      const onSend = this.options.onSend;
      await this.invokeHook(
        onSend ? (): Promise<void> => onSend(context, result) : undefined,
        "onSend"
      );
      return;
    }

    const onError = this.options.onError;
    await this.invokeHook(
      onError ? (): Promise<void> => onError(context, result) : undefined,
      "onError"
    );
  }

  private async sendOnce(run: () => Promise<SendResult>): Promise<SendResult> {
    try {
      return await run();
    } catch (error: unknown) {
      return providerErrorResult(error);
    }
  }

  private async retryTransient({
    context,
    result,
    send,
  }: {
    context: CommsHookContext;
    result: SendResult;
    send: () => Promise<SendResult>;
  }): Promise<{context: CommsHookContext; result: SendResult}> {
    if (!isTransientFailure(result)) {
      return {context, result};
    }
    const retryContext = {...context, attempt: 2, isRetry: true};
    const onRetry = this.options.onRetry;
    await this.invokeHook(
      onRetry ? (): Promise<void> => onRetry(retryContext, result) : undefined,
      "onRetry"
    );
    return {context: retryContext, result: await this.sendOnce(send)};
  }

  private mailProvider(): MailProvider {
    if (this.options.mail) {
      return this.options.mail;
    }
    if (isProduction()) {
      return throwUnconfiguredChannel();
    }
    logger.warn("[comms] Mail provider not configured; using console provider");
    return this.consoleMail;
  }

  private smsProvider(): SmsProvider {
    if (this.options.sms) {
      return this.options.sms;
    }
    if (isProduction()) {
      return throwUnconfiguredChannel();
    }
    logger.warn("[comms] SMS provider not configured; using console provider");
    return this.consoleSms;
  }

  private pushProvider(): PushProvider {
    if (this.options.push) {
      return this.options.push;
    }
    if (isProduction()) {
      return throwUnconfiguredChannel();
    }
    logger.warn("[comms] Push provider not configured; using console provider");
    return this.consolePush;
  }

  private verificationProvider(): VerificationProvider {
    if (this.options.verification) {
      return this.options.verification;
    }
    if (isProduction()) {
      return throwUnconfiguredChannel();
    }
    logger.warn("[comms] Verification provider not configured; using console provider");
    return this.consoleVerification;
  }

  async sendMail(message: MailMessage): Promise<SendResult> {
    const provider = this.mailProvider();
    let resolvedMessage: MailMessage = {
      ...message,
      from: message.from ?? this.options.defaultFrom,
    };
    let context: CommsHookContext = {
      attempt: 1,
      channel: "mail",
      isRetry: false,
      message: resolvedMessage,
      provider: provider.id,
    };
    const shaped = await this.runBeforeSend(context);
    if (shaped.cancel) {
      return this.logCancelled({
        channel: "mail",
        context,
        message: shaped.message,
        provider: provider.id,
        subject: (shaped.message as MailMessage | undefined)?.subject ?? resolvedMessage.subject,
        to: (shaped.message as MailMessage | undefined)?.to ?? resolvedMessage.to,
      });
    }
    resolvedMessage = {
      ...(shaped.message as MailMessage),
      from: (shaped.message as MailMessage).from ?? this.options.defaultFrom,
    };
    context = {...context, message: resolvedMessage};
    const send = (): Promise<SendResult> => provider.sendMail(resolvedMessage);
    const firstResult = await this.sendOnce(send);
    const stored = await this.retainedPayload(
      context,
      this.channelPayload("mail", resolvedMessage)
    );
    const row = await this.logResult({
      channel: "mail",
      payload: stored.payload,
      payloadExpiresAt: stored.payloadExpiresAt,
      provider: provider.id,
      result: firstResult,
      subject: resolvedMessage.subject,
      templateId: resolvedMessage.templateId,
      to: resolvedMessage.to,
    });
    const retried = await this.retryTransient({
      context: {...context, messageId: row?._id.toString()},
      result: firstResult,
      send,
    });
    if (retried.context.isRetry) {
      await this.logRetry({
        messageId: row?._id.toString(),
        provider: provider.id,
        result: retried.result,
      });
    }
    await this.notifyOutcomeHooks(retried.context, retried.result);
    return retried.result;
  }

  async sendSms(message: SmsMessage): Promise<SendResult> {
    const provider = this.smsProvider();
    let resolvedMessage = message;
    let context: CommsHookContext = {
      attempt: 1,
      channel: "sms",
      isRetry: false,
      message: resolvedMessage,
      provider: provider.id,
    };
    const shaped = await this.runBeforeSend(context);
    if (shaped.cancel) {
      return this.logCancelled({
        channel: "sms",
        context,
        message: shaped.message,
        provider: provider.id,
        to: (shaped.message as SmsMessage | undefined)?.to ?? resolvedMessage.to,
      });
    }
    resolvedMessage = shaped.message as SmsMessage;
    context = {...context, message: resolvedMessage};
    const send = (): Promise<SendResult> => provider.sendSms(resolvedMessage);
    const firstResult = await this.sendOnce(send);
    const stored = await this.retainedPayload(context, this.channelPayload("sms", resolvedMessage));
    const row = await this.logResult({
      channel: "sms",
      payload: stored.payload,
      payloadExpiresAt: stored.payloadExpiresAt,
      provider: provider.id,
      result: firstResult,
      to: resolvedMessage.to,
    });
    const retried = await this.retryTransient({
      context: {...context, messageId: row?._id.toString()},
      result: firstResult,
      send,
    });
    if (retried.context.isRetry) {
      await this.logRetry({
        messageId: row?._id.toString(),
        provider: provider.id,
        result: retried.result,
      });
    }
    await this.notifyOutcomeHooks(retried.context, retried.result);
    return retried.result;
  }

  async sendPushToUser(message: SendPushToUserMessage): Promise<SendResult[]> {
    const provider = this.pushProvider();
    const tokens = await PushToken.find({active: true, userId: message.userId});
    if (tokens.length === 0) {
      return [];
    }

    const baseContext: CommsHookContext = {
      attempt: 1,
      channel: "push",
      isRetry: false,
      message: {
        badge: message.badge,
        body: message.body,
        data: message.data,
        sound: message.sound,
        title: message.title,
        tokens: tokens.map((token) => token.token),
      },
      provider: provider.id,
      userId: String(message.userId),
    };
    const shaped = await this.runBeforeSend(baseContext);
    if (shaped.cancel) {
      await this.logCancelled({
        channel: "push",
        context: baseContext,
        message: shaped.message,
        provider: provider.id,
        subject: message.title,
        to: String(message.userId),
        userId: String(message.userId),
      });
      return [];
    }
    const resolvedPush =
      (shaped.message as PushMessage | undefined) ?? (baseContext.message as PushMessage);
    const sendContext = {...baseContext, message: resolvedPush};
    const stored = await this.retainedPayload(
      sendContext,
      this.channelPayload("push", resolvedPush)
    );

    const sendFor = async (tokenValues: string[]): Promise<SendResult[]> => {
      const providerMessage: PushMessage = {
        badge: resolvedPush.badge,
        body: resolvedPush.body,
        data: resolvedPush.data,
        sound: resolvedPush.sound,
        title: resolvedPush.title,
        tokens: tokenValues,
      };
      try {
        const results = await provider.sendPush(providerMessage);
        return tokenValues.map(
          (_token, index): SendResult =>
            results[index] ?? {
              accepted: false,
              error: "Provider returned no result for token",
            }
        );
      } catch (error: unknown) {
        return tokenValues.map((): SendResult => providerErrorResult(error));
      }
    };

    const firstResults = await sendFor(tokens.map((token) => token.token));
    const retryIndexes = firstResults
      .map((result, index): number => (isTransientFailure(result) ? index : -1))
      .filter((index) => index >= 0);

    const finalResults = [...firstResults];
    if (retryIndexes.length > 0) {
      const failedResult = firstResults[retryIndexes[0]] as SendResult;
      const retryContext = {...sendContext, attempt: 2, isRetry: true};
      const onRetry = this.options.onRetry;
      await this.invokeHook(
        onRetry ? (): Promise<void> => onRetry(retryContext, failedResult) : undefined,
        "onRetry"
      );
      const retryResults = await sendFor(
        retryIndexes.map((index) => tokens[index]?.token as string)
      );
      for (const [retryOffset, index] of retryIndexes.entries()) {
        finalResults[index] = retryResults[retryOffset] as SendResult;
      }
    }

    await Promise.all(
      tokens.map(async (token, index): Promise<void> => {
        const firstResult = firstResults[index] as SendResult;
        const result = finalResults[index] as SendResult;
        const wasRetried = retryIndexes.includes(index);
        const tokenContext: CommsHookContext = {
          ...sendContext,
          attempt: wasRetried ? 2 : 1,
          isRetry: wasRetried,
        };
        const row = await this.logResult({
          channel: "push",
          payload: stored.payload,
          payloadExpiresAt: stored.payloadExpiresAt,
          provider: provider.id,
          result: firstResult,
          to: token.token,
          userId: String(message.userId),
        });
        if (wasRetried) {
          await this.logRetry({
            messageId: row?._id.toString(),
            provider: provider.id,
            result,
          });
        }
        await this.notifyOutcomeHooks(tokenContext, result);
        if (!result.accepted && isPermanentTokenFailure(result)) {
          token.active = false;
          await token.save();
        }
      })
    );

    return finalResults;
  }

  async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    const provider = this.verificationProvider();
    let resolved = options;
    let context: CommsHookContext = {
      attempt: 1,
      channel: "verification",
      isRetry: false,
      message: resolved,
      provider: provider.id,
    };
    const shaped = await this.runBeforeSend(context);
    if (shaped.cancel) {
      return this.logCancelled({
        channel: "verification",
        context,
        message: shaped.message,
        provider: provider.id,
        to: resolved.to,
      });
    }
    resolved = shaped.message as StartVerificationOptions;
    context = {...context, message: resolved};
    const send = (): Promise<SendResult> => provider.startVerification(resolved);
    const firstResult = await this.sendOnce(send);
    const stored = await this.retainedPayload(
      context,
      this.channelPayload("verification", resolved)
    );
    const row = await this.logResult({
      channel: "verification",
      metadata: {verificationChannel: resolved.channel},
      payload: stored.payload,
      payloadExpiresAt: stored.payloadExpiresAt,
      provider: provider.id,
      result: firstResult,
      to: resolved.to,
    });
    const retried = await this.retryTransient({
      context: {...context, messageId: row?._id.toString()},
      result: firstResult,
      send,
    });
    if (retried.context.isRetry) {
      await this.logRetry({
        messageId: row?._id.toString(),
        provider: provider.id,
        result: retried.result,
      });
    }
    await this.notifyOutcomeHooks(retried.context, retried.result);
    return retried.result;
  }

  async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    const provider = this.verificationProvider();
    const context: CommsHookContext = {
      attempt: 1,
      channel: "verification",
      isRetry: false,
      provider: provider.id,
    };
    let check: VerificationResult;
    try {
      check = await provider.checkVerification(options);
    } catch (error: unknown) {
      const result = providerErrorResult(error);
      await this.logResult({
        channel: "verification",
        provider: provider.id,
        result,
        to: options.to,
      });
      await this.notifyOutcomeHooks(context, result);
      return {error: result.error, valid: false};
    }

    const loggedResult: SendResult = {
      accepted: check.valid,
      ...(check.valid ? {} : {error: check.error ?? "Verification check failed"}),
    };
    await this.logResult({
      channel: "verification",
      provider: provider.id,
      result: loggedResult,
      to: options.to,
    });
    await this.notifyOutcomeHooks(context, loggedResult);
    return check;
  }

  async recordDeliveryEvent(event: DeliveryEvent): Promise<void> {
    const row = await CommsMessage.findOneOrNone({providerMessageId: event.providerMessageId});
    if (!row) {
      logger.warn("[comms] No CommsMessage found for delivery event");
    } else if (event.status !== "opened") {
      row.status = event.status;
      row.errorCode = event.errorCode;
      row.errorClass = event.errorClass;
      if (event.raw !== undefined) {
        row.metadata = {...row.metadata, deliveryRaw: event.raw};
      }
      await row.save();
    }
    const onDeliveryEvent = this.options.onDeliveryEvent;
    await this.invokeHook(
      onDeliveryEvent ? (): Promise<void> => onDeliveryEvent(event) : undefined,
      "onDeliveryEvent"
    );
  }

  async recordOptOut(event: OptOutEvent): Promise<void> {
    const onOptOut = this.options.onOptOut;
    await this.invokeHook(onOptOut ? (): Promise<void> => onOptOut(event) : undefined, "onOptOut");
  }
}
