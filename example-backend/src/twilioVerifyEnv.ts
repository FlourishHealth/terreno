/**
 * Env-gated Twilio Verify provider config for `example-backend`.
 * Twilio stays an optional `@terreno/comms` peer — this file does not import it.
 */

import {APIError} from "@terreno/api";

export interface TwilioVerifyEnvConfig {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
}

const TWILIO_VERIFY_CONFIG_ERROR =
  "TWILIO_VERIFY_SERVICE_SID is set; also set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.";

export const resolveTwilioVerifyEnvConfig = (
  env: NodeJS.Dict<string> = process.env
): TwilioVerifyEnvConfig | undefined => {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const verifyServiceSid = env.TWILIO_VERIFY_SERVICE_SID?.trim() ?? "";
  if (verifyServiceSid.length === 0) {
    return undefined;
  }
  if (accountSid.length === 0 || authToken.length === 0) {
    throw new APIError({status: 500, title: TWILIO_VERIFY_CONFIG_ERROR});
  }
  return {accountSid, authToken, verifyServiceSid};
};
