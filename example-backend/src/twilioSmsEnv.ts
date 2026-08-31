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
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const fromNumber = env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
  const hasAny = Boolean(accountSid || authToken || fromNumber || messagingServiceSid);
  if (!hasAny) {
    return undefined;
  }

  const hasCreds = Boolean(accountSid && authToken);
  const hasSender = Boolean(messagingServiceSid || fromNumber);
  if (!hasCreds || !hasSender || !accountSid || !authToken) {
    throw new Error(TWILIO_SMS_CONFIG_ERROR);
  }

  return {
    accountSid,
    authToken,
    ...(fromNumber ? {fromNumber} : {}),
    ...(messagingServiceSid ? {messagingServiceSid} : {}),
  };
};
