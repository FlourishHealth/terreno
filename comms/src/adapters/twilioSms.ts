import {createRequire} from "node:module";

import type {SendResult, SmsMessage, SmsProvider} from "../types";

const nodeRequire = createRequire(__filename);

export interface TwilioMessageCreateParams {
  body: string;
  from?: string;
  messagingServiceSid?: string;
  statusCallback?: string;
  to: string;
}

export interface TwilioSmsClient {
  messages: {
    create: (params: TwilioMessageCreateParams) => Promise<{sid: string}>;
  };
}

type TwilioFactory = (accountSid: string, authToken: string) => TwilioSmsClient;

export interface TwilioSmsProviderOptions {
  accountSid?: string;
  authToken?: string;
  /** Injected client for tests. Production wiring loads `twilio`. */
  client?: TwilioSmsClient;
  fromNumber?: string;
  messagingServiceSid?: string;
  statusCallbackUrl?: string;
}

const resolveCredentials = (
  options?: TwilioSmsProviderOptions
): {accountSid: string; authToken: string} => {
  const accountSid = options?.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = options?.authToken ?? process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error(
      "TwilioSmsProvider requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN or matching constructor options"
    );
  }
  return {accountSid, authToken};
};

const loadTwilio = (): TwilioFactory => {
  try {
    // Optional peer — keep `twilio` out of core dependencies.
    return nodeRequire("twilio") as TwilioFactory;
  } catch {
    throw new Error(
      "TwilioSmsProvider requires optional peer dependency twilio. " +
        "Install it with: bun add twilio"
    );
  }
};

export class TwilioSmsProvider implements SmsProvider {
  readonly id = "twilio";
  private readonly client: TwilioSmsClient;
  private readonly fromNumber?: string;
  private readonly messagingServiceSid?: string;
  private readonly statusCallbackUrl?: string;

  constructor(options?: TwilioSmsProviderOptions) {
    const {accountSid, authToken} = resolveCredentials(options);
    this.fromNumber = options?.fromNumber ?? process.env.TWILIO_FROM_NUMBER;
    this.messagingServiceSid =
      options?.messagingServiceSid ?? process.env.TWILIO_MESSAGING_SERVICE_SID;
    this.statusCallbackUrl = options?.statusCallbackUrl;

    if (options?.client) {
      this.client = options.client;
      return;
    }

    this.client = loadTwilio()(accountSid, authToken);
  }

  async sendSms(message: SmsMessage): Promise<SendResult> {
    const params: TwilioMessageCreateParams = {
      body: message.body,
      to: message.to,
      ...(this.statusCallbackUrl ? {statusCallback: this.statusCallbackUrl} : {}),
    };
    if (this.messagingServiceSid) {
      params.messagingServiceSid = this.messagingServiceSid;
    } else if (this.fromNumber) {
      params.from = this.fromNumber;
    } else {
      return {
        accepted: false,
        error: "TwilioSmsProvider requires TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER",
        errorClass: "config",
        errorCode: "twilio-missing-sender",
      };
    }

    const created = await this.client.messages.create(params);
    return {
      accepted: true,
      providerMessageId: created.sid,
    };
  }
}
