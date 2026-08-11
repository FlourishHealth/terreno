import {logger} from "@terreno/api";

import type {
  CheckVerificationOptions,
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
} from "../types";

const DEFAULT_VERIFICATION_CODE = "123456";

export class ConsoleMailProvider implements MailProvider {
  public readonly id = "console";

  public async sendMail(message: MailMessage): Promise<SendResult> {
    logger.info("[CommsConsole] Mail accepted", {
      subject: message.subject,
      to: message.to,
    });
    return {accepted: true};
  }
}

export class ConsoleSmsProvider implements SmsProvider {
  public readonly id = "console";

  public async sendSms(message: SmsMessage): Promise<SendResult> {
    logger.info("[CommsConsole] SMS accepted", {to: message.to});
    return {accepted: true};
  }
}

export class ConsolePushProvider implements PushProvider {
  public readonly id = "console";

  public async sendPush(message: PushMessage): Promise<SendResult[]> {
    logger.info("[CommsConsole] Push accepted", {
      title: message.title,
      tokenCount: message.tokens.length,
    });
    return message.tokens.map(() => ({accepted: true}));
  }
}

export interface ConsoleVerificationProviderOptions {
  code?: string;
}

export class ConsoleVerificationProvider implements VerificationProvider {
  public readonly id = "console";
  private readonly code: string;

  public constructor(options: ConsoleVerificationProviderOptions = {}) {
    this.code = options.code ?? DEFAULT_VERIFICATION_CODE;
  }

  public async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    logger.info("[CommsConsole] Verification started", {
      channel: options.channel,
      code: this.code,
      to: options.to,
    });
    return {accepted: true};
  }

  public async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    logger.info("[CommsConsole] Verification checked", {to: options.to});
    return {valid: options.code === this.code};
  }
}
