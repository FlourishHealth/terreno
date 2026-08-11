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
    this.log(
      `[comms:mail] to=${JSON.stringify(message.to)} subject=${JSON.stringify(message.subject)}`
    );
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
    this.log(`[comms:sms] to=${message.to} body=${JSON.stringify(message.body)}`);
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
    this.log(`[comms:push] tokens=${message.tokens.length} title=${JSON.stringify(message.title)}`);
    return message.tokens.map(acceptedResult);
  }
}

export class ConsoleVerificationProvider implements VerificationProvider {
  readonly id = "console";
  private readonly log: (message: string) => void;

  constructor(options?: ConsoleProviderOptions) {
    this.log = options?.log ?? defaultLog;
  }

  async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    this.log(`[comms:verification:check] to=${options.to} code=${options.code}`);
    return {valid: true};
  }

  async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    this.log(`[comms:verification:start] to=${options.to} channel=${options.channel}`);
    return acceptedResult();
  }
}
