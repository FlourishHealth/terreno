import mongoose from "mongoose";

import {APIError} from "../../errors";
import type {WebhookClaimArgs, WebhookClaimResult, WebhookIdempotencyStore} from "./memoryStore";
import {getWebhookReceiptModel} from "./webhookReceipt";

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return (error as {code: unknown}).code === 11000;
};

let indexesReady: Promise<void> | undefined;

const ensureIndexes = async (): Promise<void> => {
  if (!indexesReady) {
    indexesReady = getWebhookReceiptModel()
      .syncIndexes()
      .then(() => undefined);
  }
  await indexesReady;
};

export const createMongoIdempotencyStore = (): WebhookIdempotencyStore => {
  const claim = async (args: WebhookClaimArgs): Promise<WebhookClaimResult> => {
    if (!mongoose.connection.db) {
      throw new APIError({
        status: 500,
        title: "Mongo webhook idempotency store requires an open mongoose connection",
      });
    }
    await ensureIndexes();
    const WebhookReceipt = getWebhookReceiptModel();
    try {
      await WebhookReceipt.create({eventId: args.eventId, source: args.source});
      return "claimed";
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return "duplicate";
      }
      throw error;
    }
  };

  const release = async (args: WebhookClaimArgs): Promise<void> => {
    const WebhookReceipt = getWebhookReceiptModel();
    await WebhookReceipt.deleteOne({eventId: args.eventId, source: args.source});
  };

  return {claim, release};
};
