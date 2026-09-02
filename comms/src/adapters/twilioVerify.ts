import {createRequire} from "node:module";
import {logger, withApiErrorHandling} from "@terreno/api";

import type {
  CheckVerificationOptions,
  CommsErrorClass,
  SendResult,
  StartVerificationOptions,
  VerificationProvider,
  VerificationResult,
} from "../types";

const PERMANENT_CODES = new Set([60200, 60202, 60203]);
const TRANSIENT_CODES = new Set([20429]);
const CONFIG_CODES = new Set([20003, 20404]);
const TWILIO_VERIFY_CONSOLE_BASE = "https://console.twilio.com/us1/develop/verify/services";

const nodeRequire = createRequire(__filename);

export interface TwilioVerifyStartParams {
  channel: "email" | "sms";
  to: string;
}

export interface TwilioVerifyCheckParams {
  code: string;
  to: string;
}

export interface TwilioVerifyService {
  verificationChecks: {
    create: (params: TwilioVerifyCheckParams) => Promise<{status: string}>;
  };
  verifications: {
    create: (params: TwilioVerifyStartParams) => Promise<{sid: string; status: string}>;
  };
}

export interface TwilioVerifyClient {
  verify: {
    v2: {
      services: (serviceSid: string) => TwilioVerifyService;
    };
  };
}

type TwilioFactory = (accountSid: string, authToken: string) => TwilioVerifyClient;

export interface TwilioVerifyProviderOptions {
  accountSid?: string;
  authToken?: string;
  /** Injected client for tests. Production wiring loads `twilio`. */
  client?: TwilioVerifyClient;
  verifyServiceSid?: string;
}

const resolveCredentials = (
  options?: TwilioVerifyProviderOptions
): {accountSid: string; authToken: string; verifyServiceSid: string} => {
  const accountSid = options?.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
  const authToken = options?.authToken ?? process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = options?.verifyServiceSid ?? process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken) {
    throw new Error(
      "TwilioVerifyProvider requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN or matching constructor options"
    );
  }
  if (!verifyServiceSid) {
    throw new Error(
      "TwilioVerifyProvider requires TWILIO_VERIFY_SERVICE_SID or a verifyServiceSid constructor option"
    );
  }
  return {accountSid, authToken, verifyServiceSid};
};

const loadTwilio = (): TwilioFactory => {
  try {
    // Optional peer — keep `twilio` out of core dependencies.
    return nodeRequire("twilio") as TwilioFactory;
  } catch {
    throw new Error(
      "TwilioVerifyProvider requires optional peer dependency twilio. " +
        "Install it with: bun add twilio"
    );
  }
};

const checkErrorForStatus = (status: string): string | undefined => {
  if (status === "approved") {
    return undefined;
  }
  if (status === "max_attempts_reached") {
    return "max-attempts";
  }
  return status;
};

interface TwilioErrorFields {
  code?: number;
  message: string;
  payload: Record<string, unknown>;
  status?: number;
}

const twilioErrorFields = (error: unknown): TwilioErrorFields => {
  if (!error || typeof error !== "object") {
    return {
      message: error instanceof Error ? error.message : "Twilio Verify request failed",
      payload: {error},
    };
  }
  const raw = error as {code?: unknown; message?: unknown; moreInfo?: unknown; status?: unknown};
  const code = typeof raw.code === "number" ? raw.code : undefined;
  const status = typeof raw.status === "number" ? raw.status : undefined;
  const message =
    typeof raw.message === "string" && raw.message.length > 0
      ? raw.message
      : error instanceof Error
        ? error.message
        : "Twilio Verify request failed";
  const payload: Record<string, unknown> = {message};
  if (code !== undefined) {
    payload.code = code;
  }
  if (status !== undefined) {
    payload.status = status;
  }
  if (typeof raw.moreInfo === "string") {
    payload.moreInfo = raw.moreInfo;
  }
  return {code, message, payload, status};
};

const classifyTwilioVerifyFailure = (
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

const failedStartResult = (error: unknown): SendResult => {
  const fields = twilioErrorFields(error);
  const {errorClass, errorCode} = classifyTwilioVerifyFailure(fields);
  if (errorClass === "config") {
    logger.error(`[comms:twilio-verify] ${errorCode}: ${fields.message}`);
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

export class TwilioVerifyProvider implements VerificationProvider {
  readonly id = "twilio-verify";
  private readonly client: TwilioVerifyClient;
  private readonly verifyServiceSid: string;

  constructor(options?: TwilioVerifyProviderOptions) {
    const {accountSid, authToken, verifyServiceSid} = resolveCredentials(options);
    this.verifyServiceSid = verifyServiceSid;
    if (options?.client) {
      this.client = options.client;
      return;
    }
    this.client = loadTwilio()(accountSid, authToken);
  }

  async startVerification(options: StartVerificationOptions): Promise<SendResult> {
    try {
      const created = await withApiErrorHandling(
        () =>
          this.client.verify.v2
            .services(this.verifyServiceSid)
            .verifications.create({channel: options.channel, to: options.to}),
        {apiName: "twilio-verify", operation: "startVerification"}
      );
      return {
        accepted: true,
        metadata: {consoleUrl: `${TWILIO_VERIFY_CONSOLE_BASE}/${this.verifyServiceSid}`},
        providerMessageId: created.sid,
      };
    } catch (error: unknown) {
      return failedStartResult(error);
    }
  }

  async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    try {
      const checked = await withApiErrorHandling(
        () =>
          this.client.verify.v2
            .services(this.verifyServiceSid)
            .verificationChecks.create({code: options.code, to: options.to}),
        {apiName: "twilio-verify", operation: "checkVerification"}
      );
      const error = checkErrorForStatus(checked.status);
      if (error === undefined) {
        return {valid: true};
      }
      return {error, valid: false};
    } catch (error: unknown) {
      const fields = twilioErrorFields(error);
      return {error: fields.message, valid: false};
    }
  }
}
