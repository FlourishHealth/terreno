import * as Sentry from "@sentry/bun";
import axios from "axios";

import {APIError, errorMessage} from "../errors";
import {logger} from "../logger";
// Convenience method to send data to a Slack webhook.
// If `url` is provided, it will be used directly instead of looking up from environment.
// DEPRECATED: Looking up webhook URLs from the SLACK_WEBHOOKS environment variable by channel name
// is deprecated and will be removed in a future version. Please pass the `url` parameter directly.
export const sendToSlack = async (
  text: string,
  {
    slackChannel,
    shouldThrow = false,
    env,
    url,
  }: {slackChannel?: string; shouldThrow?: boolean; env?: string; url?: string} = {}
): Promise<void> => {
  let slackWebhookUrl = url;

  if (!slackWebhookUrl) {
    logger.debug(
      "DEPRECATED: Looking up webhook URLs from SLACK_WEBHOOKS environment variable is deprecated and will be removed in a future version. Please pass the url parameter directly."
    );
    // since Slack now requires a webhook for each channel, we need to store them in the environment
    // as an object, so we can look them up by channel name.
    const slackWebhooksString = process.env.SLACK_WEBHOOKS;
    if (!slackWebhooksString) {
      logger.debug("You must set SLACK_WEBHOOKS in the environment to use sendToSlack.");
      return;
    }
    const slackWebhooks = JSON.parse(slackWebhooksString ?? "{}");

    const channel = slackChannel ?? "default";

    slackWebhookUrl = slackWebhooks[channel] ?? slackWebhooks.default;

    if (!slackWebhookUrl) {
      Sentry.captureException(
        new APIError({
          status: 500,
          title: `No webhook url set in env for ${channel}. Slack message not sent`,
        })
      );
      logger.debug(`No webhook url set in env for ${channel}.`);
      return;
    }
  }

  let formattedText = text;
  if (env) {
    formattedText = `[${env.toUpperCase()}] ${text}`;
  }

  try {
    await axios.post(slackWebhookUrl, {
      text: formattedText,
    });
  } catch (error: unknown) {
    const message = errorMessage(error);
    logger.error(`Error posting to slack: ${message}`);
    Sentry.captureException(error);
    if (shouldThrow) {
      throw new APIError({
        status: 500,
        title: `Error posting to slack: ${message}`,
      });
    }
  }
};
