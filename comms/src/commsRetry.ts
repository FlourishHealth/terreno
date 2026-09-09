import {APIError} from "@terreno/api";
import {DateTime} from "luxon";

import type {CommsMessageDocument} from "./modelTypes";
import type {CommsChannel} from "./types";

export const COMMS_RETRY_NOT_RETRYABLE = "comms-retry-not-retryable";
export const COMMS_RETRY_PAYLOAD_EXPIRED = "comms-retry-payload-expired";
export const COMMS_RETRY_CHANNEL_UNCONFIGURED = "comms-retry-channel-unconfigured";

export interface CommsRetryBlock {
  code: string;
  title: string;
}

const RETRYABLE_STATUSES = new Set(["bounced", "failed"]);

export const isPayloadPresent = (message: CommsMessageDocument): boolean => {
  if (message.payload === undefined || message.payload === null) {
    return false;
  }
  if (message.payloadExpiresAt && DateTime.fromJSDate(message.payloadExpiresAt) <= DateTime.utc()) {
    return false;
  }
  return true;
};

export const evaluateRetryBlock = ({
  isChannelConfigured,
  message,
}: {
  isChannelConfigured: (channel: CommsChannel) => boolean;
  message: CommsMessageDocument;
}): CommsRetryBlock | undefined => {
  if (message.channel === "verification") {
    return {
      code: COMMS_RETRY_NOT_RETRYABLE,
      title: "Verification messages are not retryable",
    };
  }
  if (!RETRYABLE_STATUSES.has(message.status)) {
    return {
      code: COMMS_RETRY_NOT_RETRYABLE,
      title: "Only failed or bounced messages can be retried",
    };
  }
  if (message.errorClass === "permanent") {
    return {
      code: COMMS_RETRY_NOT_RETRYABLE,
      title: "Permanent failures cannot be retried",
    };
  }
  if (!isPayloadPresent(message)) {
    return {
      code: COMMS_RETRY_PAYLOAD_EXPIRED,
      title: "Retained payload is missing or expired",
    };
  }
  if (!isChannelConfigured(message.channel)) {
    return {
      code: COMMS_RETRY_CHANNEL_UNCONFIGURED,
      title: "Comms channel is not configured",
    };
  }
  return undefined;
};

export const throwRetryBlock = (block: CommsRetryBlock): never => {
  throw new APIError({
    code: block.code,
    status: 400,
    title: block.title,
  });
};

export const serializeCommsMessage = (
  message: CommsMessageDocument,
  isChannelConfigured: (channel: CommsChannel) => boolean
): Record<string, unknown> => {
  const json = message.toJSON() as Record<string, unknown>;
  const block = evaluateRetryBlock({isChannelConfigured, message});
  return {
    ...json,
    retryable: !block,
    retryDisabledReason: block?.title,
  };
};
