import {DateTime} from "luxon";
import mongoose from "mongoose";

import {findExactlyOne, findOneOrNone} from "../../plugins";
import type {WebhookReceiptDocument, WebhookReceiptModel} from "./webhookReceiptTypes";

export const WEBHOOK_RECEIPTS_COLLECTION = "webhookReceipts";
export const DEFAULT_WEBHOOK_RECEIPT_TTL_DAYS = 7;

const secondsPerDay = 86_400;

export const webhookReceiptSchema = new mongoose.Schema<
  WebhookReceiptDocument,
  WebhookReceiptModel
>(
  {
    created: {
      default: () => DateTime.utc().toJSDate(),
      description: "When this webhook event id was first claimed",
      required: true,
      type: Date,
    },
    eventId: {
      description: "Provider event id claimed for this source",
      required: true,
      type: String,
    },
    source: {
      description: "Webhook source label (for example stripe or sendgrid)",
      required: true,
      type: String,
    },
  },
  {collection: WEBHOOK_RECEIPTS_COLLECTION, strict: "throw"}
);

webhookReceiptSchema.index({eventId: 1, source: 1}, {unique: true});
webhookReceiptSchema.index(
  {created: 1},
  {expireAfterSeconds: DEFAULT_WEBHOOK_RECEIPT_TTL_DAYS * secondsPerDay}
);

webhookReceiptSchema.plugin(findOneOrNone);
webhookReceiptSchema.plugin(findExactlyOne);

export const getWebhookReceiptModel = (): WebhookReceiptModel => {
  return (
    (mongoose.models.WebhookReceipt as WebhookReceiptModel | undefined) ??
    mongoose.model<WebhookReceiptDocument, WebhookReceiptModel>(
      "WebhookReceipt",
      webhookReceiptSchema
    )
  );
};
