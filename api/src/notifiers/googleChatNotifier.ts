import * as Sentry from "@sentry/bun";
import axios from "axios";

import {APIError, errorMessage} from "../errors";
import {logger} from "../logger";

export const sendToGoogleChat = async (
  messageText: string,
  {channel, shouldThrow = false, env}: {channel?: string; shouldThrow?: boolean; env?: string} = {}
): Promise<void> => {
  const chatWebhooksString = process.env.GOOGLE_CHAT_WEBHOOKS;
  if (!chatWebhooksString) {
    const msg = "GOOGLE_CHAT_WEBHOOKS not set. Google Chat message not sent";
    Sentry.captureException(new APIError({status: 500, title: msg}));
    logger.error(msg);
    return;
  }
  const chatWebhooks = JSON.parse(chatWebhooksString ?? "{}");

  const chatChannel = channel ?? "default";
  const chatWebhookUrl = chatWebhooks[chatChannel] ?? chatWebhooks.default;

  if (!chatWebhookUrl) {
    const msg = `No webhook url set in env for ${chatChannel}. Google Chat message not sent`;
    Sentry.captureException(new APIError({status: 500, title: msg}));
    logger.error(msg);
    return;
  }

  let formattedMessageText = messageText;
  if (env) {
    formattedMessageText = `[${env.toUpperCase()}] ${messageText}`;
  }

  try {
    await axios.post(chatWebhookUrl, {text: formattedMessageText});
  } catch (error: unknown) {
    const message = errorMessage(error);
    logger.error(`Error posting to Google Chat: ${message}`);
    Sentry.captureException(error);
    if (shouldThrow) {
      throw new APIError({
        status: 500,
        title: `Error posting to Google Chat: ${message}`,
      });
    }
  }
};
