import {APIError, logger} from "@terreno/api";

import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "./adapters/console";
import {CommsMessage} from "./models/commsMessage";
import {PushToken} from "./models/pushToken";
import type {
  CheckVerificationOptions,
  CommsOptions,
  MailMessage,
  MailProvider,
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
    provider,
    result,
    subject,
    to,
    userId,
  }: {
    channel: "mail" | "push" | "sms" | "verification";
    metadata?: Record<string, unknown>;
    provider: string;
    result: SendResult;
    subject?: string;
    to: string | string[];
    userId?: string;
  }): Promise<void> {
    if (this.options.logMessages === false) {
      return;
    }

    await CommsMessage.logSend({
      channel,
      error: result.error,
      errorClass: result.errorClass,
      errorCode: result.errorCode,
      metadata: {...result.metadata, ...metadata},
      provider,
      providerMessageId: result.providerMessageId,
      status: result.accepted ? "sent" : "failed",
      subject,
      to: this.recipientForLog(to),
      userId,
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

  private async sendMailOnce(provider: MailProvider, message: MailMessage): Promise<SendResult> {
    try {
      return await provider.sendMail(message);
    } catch (error: unknown) {
      return {
        accepted: false,
        error: error instanceof Error ? error.message : "Provider send failed",
        errorClass: "transient",
        errorCode: "provider-throw",
      };
    }
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
    const resolvedMessage = {
      ...message,
      from: message.from ?? this.options.defaultFrom,
    };
    const context = {channel: "mail" as const, provider: provider.id};

    let result = await this.sendMailOnce(provider, resolvedMessage);
    if (!result.accepted && result.errorClass === "transient") {
      const onRetry = this.options.onRetry;
      await this.invokeHook(
        onRetry ? (): Promise<void> => onRetry(context, result) : undefined,
        "onRetry"
      );
      result = await this.sendMailOnce(provider, resolvedMessage);
    }

    await this.logResult({
      channel: "mail",
      provider: provider.id,
      result,
      subject: message.subject,
      to: message.to,
    });

    await this.notifyOutcomeHooks(context, result);

    return result;
  }

  async sendSms(message: SmsMessage): Promise<SendResult> {
    const provider = this.smsProvider();
    const context = {channel: "sms" as const, provider: provider.id};

    try {
      const result = await provider.sendSms(message);
      await this.logResult({
        channel: "sms",
        provider: provider.id,
        result,
        to: message.to,
      });
      await this.notifyOutcomeHooks(context, result);
      return result;
    } catch (error: unknown) {
      const result = {accepted: false, error: "Provider send failed"};
      await this.logResult({
        channel: "sms",
        provider: provider.id,
        result,
        to: message.to,
      });
      await this.notifyOutcomeHooks(context, result);
      throw error;
    }
  }

  async sendPushToUser(message: SendPushToUserMessage): Promise<SendResult[]> {
    const provider = this.pushProvider();
    const context = {channel: "push" as const, provider: provider.id};
    const tokens = await PushToken.find({active: true, userId: message.userId});
    if (tokens.length === 0) {
      return [];
    }

    const providerMessage: PushMessage = {
      badge: message.badge,
      body: message.body,
      data: message.data,
      sound: message.sound,
      title: message.title,
      tokens: tokens.map((token) => token.token),
    };
    let results: SendResult[];
    try {
      results = await provider.sendPush(providerMessage);
    } catch (error: unknown) {
      const failedResult = {accepted: false, error: "Provider send failed"};
      await Promise.all(
        tokens.map(
          (token): Promise<void> =>
            this.logResult({
              channel: "push",
              provider: provider.id,
              result: failedResult,
              to: token.token,
              userId: String(message.userId),
            })
        )
      );
      await Promise.all(
        tokens.map(
          (): Promise<void> => this.notifyOutcomeHooks(context, failedResult)
        )
      );
      throw error;
    }

    const normalizedResults = tokens.map(
      (_token, index): SendResult =>
        results[index] ?? {
          accepted: false,
          error: "Provider returned no result for token",
        }
    );
    await Promise.all(
      tokens.map(async (token, index): Promise<void> => {
        const result = normalizedResults[index] as SendResult;
        await this.logResult({
          channel: "push",
          provider: provider.id,
          result,
          to: token.token,
          userId: String(message.userId),
        });
        await this.notifyOutcomeHooks(context, result);
        if (!result.accepted && result.isPermanentFailure) {
          token.active = false;
          await token.save();
        }
      })
    );

    return normalizedResults;
  }

  async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    const provider = this.verificationProvider();
    const context = {channel: "verification" as const, provider: provider.id};
    try {
      const result = await provider.startVerification(options);
      await this.logResult({
        channel: "verification",
        metadata: {verificationChannel: options.channel},
        provider: provider.id,
        result,
        to: options.to,
      });
      await this.notifyOutcomeHooks(context, result);
      return result;
    } catch (error: unknown) {
      const result = {accepted: false, error: "Provider send failed"};
      await this.logResult({
        channel: "verification",
        metadata: {verificationChannel: options.channel},
        provider: provider.id,
        result,
        to: options.to,
      });
      await this.notifyOutcomeHooks(context, result);
      throw error;
    }
  }

  async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    const provider = this.verificationProvider();
    const context = {channel: "verification" as const, provider: provider.id};
    try {
      const result = await provider.checkVerification(options);
      const loggedResult: SendResult = {
        accepted: result.valid,
        ...(result.valid ? {} : {error: result.error ?? "Verification check failed"}),
      };
      await this.logResult({
        channel: "verification",
        provider: provider.id,
        result: loggedResult,
        to: options.to,
      });
      await this.notifyOutcomeHooks(context, loggedResult);
      return result;
    } catch (error: unknown) {
      const loggedResult = {accepted: false, error: "Provider check failed"};
      await this.logResult({
        channel: "verification",
        provider: provider.id,
        result: loggedResult,
        to: options.to,
      });
      await this.notifyOutcomeHooks(context, loggedResult);
      throw error;
    }
  }
}
