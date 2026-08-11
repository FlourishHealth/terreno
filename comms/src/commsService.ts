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
    provider,
    result,
    subject,
    to,
    userId,
  }: {
    channel: "mail" | "push" | "sms" | "verification";
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
      provider,
      providerMessageId: result.providerMessageId,
      status: result.accepted ? "sent" : "failed",
      subject,
      to: this.recipientForLog(to),
      userId,
    });
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

    try {
      const result = await provider.sendMail(resolvedMessage);
      await this.logResult({
        channel: "mail",
        provider: provider.id,
        result,
        subject: message.subject,
        to: message.to,
      });
      return result;
    } catch (error: unknown) {
      await this.logResult({
        channel: "mail",
        provider: provider.id,
        result: {accepted: false, error: "Provider send failed"},
        subject: message.subject,
        to: message.to,
      });
      throw error;
    }
  }

  async sendSms(message: SmsMessage): Promise<SendResult> {
    const provider = this.smsProvider();

    try {
      const result = await provider.sendSms(message);
      await this.logResult({
        channel: "sms",
        provider: provider.id,
        result,
        to: message.to,
      });
      return result;
    } catch (error: unknown) {
      await this.logResult({
        channel: "sms",
        provider: provider.id,
        result: {accepted: false, error: "Provider send failed"},
        to: message.to,
      });
      throw error;
    }
  }

  async sendPushToUser(message: SendPushToUserMessage): Promise<SendResult[]> {
    const provider = this.pushProvider();
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
    const results = await provider.sendPush(providerMessage);

    await Promise.all(
      tokens.map(async (token, index): Promise<void> => {
        const result = results[index] ?? {
          accepted: false,
          error: "Provider returned no result for token",
        };
        await this.logResult({
          channel: "push",
          provider: provider.id,
          result,
          to: token.token,
          userId: String(message.userId),
        });
        if (!result.accepted && result.isPermanentFailure) {
          token.active = false;
          await token.save();
        }
      })
    );

    return results;
  }

  async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    const provider = this.verificationProvider();
    const result = await provider.startVerification(options);
    await this.logResult({
      channel: "verification",
      provider: provider.id,
      result,
      to: options.to,
    });
    return result;
  }

  async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    const provider = this.verificationProvider();
    const result = await provider.checkVerification(options);
    await this.logResult({
      channel: "verification",
      provider: provider.id,
      result: {accepted: true},
      to: options.to,
    });
    return result;
  }
}
