import {createRequire} from "node:module";
import {logger, withApiErrorHandling} from "@terreno/api";
import {parsePhoneNumberFromString} from "libphonenumber-js";

import type {CommsErrorClass, SendResult, SmsMessage, SmsProvider} from "../types";

const nodeRequire = createRequire(__filename);

const TWILIO_SMS_CONSOLE_BASE = "https://console.twilio.com/us1/monitor/logs/sms";

const twilioMessageConsoleUrl = (sid: string): string => `${TWILIO_SMS_CONSOLE_BASE}/${sid}`;

const PERMANENT_CODES = new Set([21211, 21214, 21217, 21408, 21610, 30003, 30005, 30006, 30007]);
const TRANSIENT_CODES = new Set([20429, 30001, 30002]);
const CONFIG_CODES = new Set([20003, 20404]);

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

interface TwilioErrorFields {
  code?: number;
  message: string;
  payload: Record<string, unknown>;
  status?: number;
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

const toE164 = (to: string): string | undefined => {
  const parsed = parsePhoneNumberFromString(to);
  if (!parsed?.isValid()) {
    return undefined;
  }
  return parsed.format("E.164");
};

const invalidDestinationResult = (): SendResult => ({
  accepted: false,
  error: "Destination must be a valid E.164 phone number",
  errorClass: "permanent",
  errorCode: "twilio-invalid-destination",
  isPermanentFailure: true,
});

const twilioErrorFields = (error: unknown): TwilioErrorFields => {
  if (!error || typeof error !== "object") {
    return {
      message: error instanceof Error ? error.message : "Twilio send failed",
      payload: {error},
    };
  }
  const raw = error as {
    code?: unknown;
    message?: unknown;
    moreInfo?: unknown;
    status?: unknown;
  };
  const code = typeof raw.code === "number" ? raw.code : undefined;
  const status = typeof raw.status === "number" ? raw.status : undefined;
  const message =
    typeof raw.message === "string" && raw.message.length > 0
      ? raw.message
      : error instanceof Error
        ? error.message
        : "Twilio send failed";
  const payload: Record<string, unknown> = {};
  if (code !== undefined) {
    payload.code = code;
  }
  if (status !== undefined) {
    payload.status = status;
  }
  payload.message = message;
  if (typeof raw.moreInfo === "string") {
    payload.moreInfo = raw.moreInfo;
  }
  return {code, message, payload, status};
};

const classifyTwilioFailure = (
  fields: TwilioErrorFields
): {errorClass: CommsErrorClass; errorCode: string} => {
  if (fields.code !== undefined && PERMANENT_CODES.has(fields.code)) {
    return {errorClass: "permanent", errorCode: String(fields.code)};
  }
  if (fields.code !== undefined && CONFIG_CODES.has(fields.code)) {
    return {errorClass: "config", errorCode: String(fields.code)};
  }
  if (fields.code !== undefined && TRANSIENT_CODES.has(fields.code)) {
    return {errorClass: "transient", errorCode: String(fields.code)};
  }
  if (fields.status === 429 || (fields.status !== undefined && fields.status >= 500)) {
    return {
      errorClass: "transient",
      errorCode: fields.code !== undefined ? String(fields.code) : `twilio-${fields.status}`,
    };
  }
  if (fields.code !== undefined) {
    return {errorClass: "transient", errorCode: String(fields.code)};
  }
  return {errorClass: "transient", errorCode: "twilio-network"};
};

const failedResult = (error: unknown): SendResult => {
  const fields = twilioErrorFields(error);
  const {errorClass, errorCode} = classifyTwilioFailure(fields);
  if (errorClass === "config") {
    logger.error(`[comms:twilio] ${errorCode}: ${fields.message}`);
  }
  return {
    accepted: false,
    error: fields.message,
    errorClass,
    errorCode,
    isPermanentFailure: errorClass === "permanent",
    metadata: {twilioError: fields.payload},
  };
};

export class TwilioSmsProvider implements SmsProvider {
  readonly id = "twilio";
  private readonly authToken: string;
  private readonly client: TwilioSmsClient;
  private readonly fromNumber?: string;
  private readonly messagingServiceSid?: string;
  private statusCallbackUrl?: string;

  constructor(options?: TwilioSmsProviderOptions) {
    const {accountSid, authToken} = resolveCredentials(options);
    this.authToken = authToken;
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

  getAuthToken = (): string => {
    return this.authToken;
  };

  applyDefaultStatusCallbackUrl = (url: string): void => {
    if (!this.statusCallbackUrl) {
      this.statusCallbackUrl = url;
    }
  };

  async sendSms(message: SmsMessage): Promise<SendResult> {
    const to = toE164(message.to);
    if (!to) {
      return invalidDestinationResult();
    }
    const params: TwilioMessageCreateParams = {
      body: message.body,
      to,
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

    try {
      const created = await withApiErrorHandling(() => this.client.messages.create(params), {
        apiName: "twilio",
        operation: "sendSms",
      });
      return {
        accepted: true,
        metadata: {consoleUrl: twilioMessageConsoleUrl(created.sid)},
        providerMessageId: created.sid,
      };
    } catch (error: unknown) {
      return failedResult(error);
    }
  }
}
