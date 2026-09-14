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

interface ConsoleProviderOptions {
  log?: (message: string) => void;
}

const defaultLog = (message: string): void => {
  logger.info(message);
};

const acceptedResult = (): SendResult => ({accepted: true});

export class ConsoleMailProvider implements MailProvider {
  readonly id = "console";
  private readonly log: (message: string) => void;

  constructor(options?: ConsoleProviderOptions) {
    this.log = options?.log ?? defaultLog;
  }

  async sendMail(message: MailMessage): Promise<SendResult> {
    const recipientCount = Array.isArray(message.to) ? message.to.length : 1;
    this.log(`[comms:mail] recipients=${recipientCount} subjectLength=${message.subject.length}`);
    return acceptedResult();
  }
}

export class ConsoleSmsProvider implements SmsProvider {
  readonly id = "console";
  private readonly log: (message: string) => void;

  constructor(options?: ConsoleProviderOptions) {
    this.log = options?.log ?? defaultLog;
  }

  async sendSms(message: SmsMessage): Promise<SendResult> {
    this.log(`[comms:sms] bodyLength=${message.body.length}`);
    return acceptedResult();
  }
}

export class ConsolePushProvider implements PushProvider {
  readonly id = "console";
  private readonly log: (message: string) => void;

  constructor(options?: ConsoleProviderOptions) {
    this.log = options?.log ?? defaultLog;
  }

  async sendPush(message: PushMessage): Promise<SendResult[]> {
    this.log(`[comms:push] tokens=${message.tokens.length} titleLength=${message.title.length}`);
    return message.tokens.map(acceptedResult);
  }
}

export class ConsoleVerificationProvider implements VerificationProvider {
  readonly id = "console";
  private readonly log: (message: string) => void;

  constructor(options?: ConsoleProviderOptions) {
    this.log = options?.log ?? defaultLog;
  }

  async checkVerification(_options: CheckVerificationOptions): Promise<VerificationResult> {
    this.log("[comms:verification:check]");
    return {valid: true};
  }

  async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    this.log(`[comms:verification:start] channel=${options.channel}`);
    return acceptedResult();
  }
}
