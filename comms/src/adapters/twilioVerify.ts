import {createRequire} from "node:module";

import type {
  CheckVerificationOptions,
  SendResult,
  StartVerificationOptions,
  VerificationProvider,
  VerificationResult,
} from "../types";

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
    const created = await this.client.verify.v2
      .services(this.verifyServiceSid)
      .verifications.create({channel: options.channel, to: options.to});
    return {
      accepted: true,
      providerMessageId: created.sid,
    };
  }

  async checkVerification(options: CheckVerificationOptions): Promise<VerificationResult> {
    const checked = await this.client.verify.v2
      .services(this.verifyServiceSid)
      .verificationChecks.create({code: options.code, to: options.to});
    const error = checkErrorForStatus(checked.status);
    if (error === undefined) {
      return {valid: true};
    }
    return {error, valid: false};
  }
}
