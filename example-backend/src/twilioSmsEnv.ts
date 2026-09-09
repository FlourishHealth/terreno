import {APIError} from "@terreno/api";

export interface TwilioSmsEnvConfig {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
}

const TWILIO_SMS_CONFIG_ERROR =
  "Twilio SMS requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER";

export const resolveTwilioSmsEnvConfig = (
  env: NodeJS.Dict<string> = process.env
): TwilioSmsEnvConfig | undefined => {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const fromNumber = env.TWILIO_FROM_NUMBER?.trim() ?? "";
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim() ?? "";
  const hasSender = messagingServiceSid.length > 0 || fromNumber.length > 0;
  if (!hasSender) {
    return undefined;
  }

  const hasCreds = accountSid.length > 0 && authToken.length > 0;
  if (!hasCreds) {
    throw new APIError({status: 500, title: TWILIO_SMS_CONFIG_ERROR});
  }

  return {
    accountSid,
    authToken,
    ...(fromNumber.length > 0 ? {fromNumber} : {}),
    ...(messagingServiceSid.length > 0 ? {messagingServiceSid} : {}),
  };
};
