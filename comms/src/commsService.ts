import {APIError, logger} from "@terreno/api";

import {
  ConsoleMailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
} from "./adapters/console";
import {CommsMessage} from "./models/commsMessage";
import type {
  CheckVerificationOptions,
  LogSendParams,
  MailMessage,
  MailProvider,
  PushMessage,
  PushProvider,
  SendResult,
  SmsMessage,
  SmsProvider,
  StartVerificationOptions,
  VerificationProvider,
  VerificationResult,
} from "./types";

export interface CommsServiceOptions {
  defaultFrom?: string;
  logMessages?: boolean;
  logSend?: (entry: LogSendParams) => Promise<void>;
  mail?: MailProvider;
  push?: PushProvider;
  redactRecipients?: boolean;
  sms?: SmsProvider;
  verification?: VerificationProvider;
}

const redactRecipient = (recipient: string): string => {
  const emailParts = recipient.split("@");
  if (emailParts.length === 2) {
    const [localPart, domain] = emailParts;
    return `${localPart.slice(0, 1)}***@${domain}`;
  }

  if (recipient.length <= 4) {
    return "***";
  }

  return `***${recipient.slice(-4)}`;
};

const destinationToString = (destination: string | string[]): string =>
  Array.isArray(destination) ? destination.join(",") : destination;

export class CommsService {
  private readonly defaultFrom?: string;
  private readonly isLoggingEnabled: boolean;
  private readonly logSend: (entry: LogSendParams) => Promise<void>;
  private readonly mail?: MailProvider;
  private readonly push?: PushProvider;
  private readonly shouldRedactRecipients: boolean;
  private readonly sms?: SmsProvider;
  private readonly verification?: VerificationProvider;

  public constructor(options: CommsServiceOptions = {}) {
    this.defaultFrom = options.defaultFrom;
    this.isLoggingEnabled = options.logMessages ?? true;
    this.logSend =
      options.logSend ??
      (async (entry): Promise<void> => {
        await CommsMessage.logSend(entry);
      });
    this.mail = options.mail;
    this.push = options.push;
    this.shouldRedactRecipients = options.redactRecipients ?? true;
    this.sms = options.sms;
    this.verification = options.verification;
  }

  public async sendMail(message: MailMessage): Promise<SendResult> {
    const provider = this.resolveMailProvider();
    const messageWithFrom = {...message, from: message.from ?? this.defaultFrom};

    try {
      const result = await provider.sendMail(messageWithFrom);
      await this.recordResult({
        channel: "mail",
        destination: destinationToString(message.to),
        provider: provider.id,
        result,
        subject: message.subject,
      });
      return result;
    } catch (error) {
      await this.recordThrownError({
        channel: "mail",
        destination: destinationToString(message.to),
        error,
        provider: provider.id,
        subject: message.subject,
      });
      throw error;
    }
  }

  public async sendSms(message: SmsMessage): Promise<SendResult> {
    const provider = this.resolveSmsProvider();

    try {
      const result = await provider.sendSms(message);
      await this.recordResult({
        channel: "sms",
        destination: message.to,
        provider: provider.id,
        result,
      });
      return result;
    } catch (error) {
      await this.recordThrownError({
        channel: "sms",
        destination: message.to,
        error,
        provider: provider.id,
      });
      throw error;
    }
  }

  public async sendPush(message: PushMessage): Promise<SendResult[]> {
    const provider = this.resolvePushProvider();

    try {
      const results = await provider.sendPush(message);
      await Promise.all(
        results.map(async (result, index): Promise<void> => {
          await this.recordResult({
            channel: "push",
            destination: message.tokens[index] ?? "unknown-token",
            provider: provider.id,
            result,
          });
        })
      );
      return results;
    } catch (error) {
      await this.recordThrownError({
        channel: "push",
        destination: `${message.tokens.length} tokens`,
        error,
        provider: provider.id,
      });
      throw error;
    }
  }

  public async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    const provider = this.resolveVerificationProvider();

    try {
      const result = await provider.startVerification(options);
      await this.recordResult({
        channel: "verification",
        destination: options.to,
        provider: provider.id,
        result,
      });
      return result;
    } catch (error) {
      await this.recordThrownError({
        channel: "verification",
        destination: options.to,
        error,
        provider: provider.id,
      });
      throw error;
    }
  }

  public async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    return this.resolveVerificationProvider().checkVerification(options);
  }

  private resolveMailProvider(): MailProvider {
    return this.resolveProvider({
      channel: "mail",
      configuredProvider: this.mail,
      consoleProvider: new ConsoleMailProvider(),
    });
  }

  private resolveSmsProvider(): SmsProvider {
    return this.resolveProvider({
      channel: "sms",
      configuredProvider: this.sms,
      consoleProvider: new ConsoleSmsProvider(),
    });
  }

  private resolvePushProvider(): PushProvider {
    return this.resolveProvider({
      channel: "push",
      configuredProvider: this.push,
      consoleProvider: new ConsolePushProvider(),
    });
  }

  private resolveVerificationProvider(): VerificationProvider {
    return this.resolveProvider({
      channel: "verification",
      configuredProvider: this.verification,
      consoleProvider: new ConsoleVerificationProvider(),
    });
  }

  private resolveProvider<T>({
    channel,
    configuredProvider,
    consoleProvider,
  }: {
    channel: string;
    configuredProvider?: T;
    consoleProvider: T;
  }): T {
    if (configuredProvider !== undefined) {
      return configuredProvider;
    }

    if (process.env.NODE_ENV === "production") {
      throw new APIError({
        detail: `The ${channel} provider is not configured`,
        status: 501,
        title: "Comms channel not configured",
      });
    }

    logger.warn(`[Comms] ${channel} channel is using the console provider`);
    return consoleProvider;
  }

  private async recordResult({
    channel,
    destination,
    provider,
    result,
    subject,
  }: {
    channel: LogSendParams["channel"];
    destination: string;
    provider: string;
    result: SendResult;
    subject?: string;
  }): Promise<void> {
    await this.record({
      channel,
      error: result.error,
      metadata: result.metadata,
      provider,
      providerMessageId: result.providerMessageId,
      status: result.accepted ? "sent" : "failed",
      subject,
      to: this.prepareDestination(destination),
    });
  }

  private async recordThrownError({
    channel,
    destination,
    error,
    provider,
    subject,
  }: {
    channel: LogSendParams["channel"];
    destination: string;
    error: unknown;
    provider: string;
    subject?: string;
  }): Promise<void> {
    await this.record({
      channel,
      error: error instanceof Error ? error.message : String(error),
      provider,
      status: "failed",
      subject,
      to: this.prepareDestination(destination),
    });
  }

  private async record(entry: LogSendParams): Promise<void> {
    if (!this.isLoggingEnabled) {
      return;
    }

    try {
      await this.logSend(entry);
    } catch (error) {
      logger.catch(error);
    }
  }

  private prepareDestination(destination: string): string {
    if (!this.shouldRedactRecipients) {
      return destination;
    }

    return destination
      .split(",")
      .map((recipient) => redactRecipient(recipient.trim()))
      .join(",");
  }
}
