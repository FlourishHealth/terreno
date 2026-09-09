import mongoose from "mongoose";

import {APIError} from "../../errors";
import type {WebhookClaimArgs, WebhookClaimResult, WebhookIdempotencyStore} from "./memoryStore";
import {
  DEFAULT_WEBHOOK_RECEIPT_TTL_DAYS,
  getWebhookReceiptModel,
  WEBHOOK_RECEIPTS_COLLECTION,
} from "./webhookReceipt";

const isDuplicateKeyError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  return (error as {code: unknown}).code === 11000;
};

export const createMongoIdempotencyStore = ({
  ttlDays = DEFAULT_WEBHOOK_RECEIPT_TTL_DAYS,
}: {
  ttlDays?: number;
} = {}): WebhookIdempotencyStore => {
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    throw new APIError({
      status: 500,
      title: "Mongo webhook idempotency ttlDays must be a positive number",
    });
  }
  const expireAfterSeconds = Math.round(ttlDays * 86_400);
  let indexesReady: Promise<void> | undefined;

  const ensureIndexes = async (): Promise<void> => {
    if (!indexesReady) {
      indexesReady = getWebhookReceiptModel()
        .syncIndexes()
        .then(async () => {
          const db = mongoose.connection.db;
          if (!db) {
            return;
          }
          await db.command({
            collMod: WEBHOOK_RECEIPTS_COLLECTION,
            index: {
              expireAfterSeconds,
              keyPattern: {created: 1},
            },
          });
        })
        .catch((error: unknown) => {
          indexesReady = undefined;
          throw error;
        });
    }
    await indexesReady;
  };

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
