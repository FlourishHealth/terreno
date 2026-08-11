import {createdUpdatedPlugin, isDeletedPlugin, logger} from "@terreno/api";
import mongoose from "mongoose";

import type {CommsMessageDocument, CommsMessageModel, LogSendParams} from "../types";

const commsMessageSchema = new mongoose.Schema<CommsMessageDocument, CommsMessageModel>(
  {
    channel: {
      description: "Communication channel used for the send attempt",
      enum: ["mail", "sms", "push", "verification"],
      required: true,
      type: String,
    },
    error: {
      description: "Provider error returned for a failed send attempt",
      type: String,
    },
    metadata: {
      description: "Provider-independent metadata associated with the send attempt",
      type: mongoose.Schema.Types.Mixed,
    },
    provider: {
      description: "Stable identifier of the provider handling the send",
      required: true,
      type: String,
    },
    providerMessageId: {
      description: "Provider-assigned identifier used to correlate delivery callbacks",
      index: true,
      type: String,
    },
    status: {
      description: "Latest known delivery status",
      enum: ["sent", "failed", "delivered", "bounced"],
      required: true,
      type: String,
    },
    subject: {
      description: "Mail subject when the communication channel is mail",
      type: String,
    },
    to: {
      description: "Redacted or application-approved communication destination",
      required: true,
      type: String,
    },
    userId: {
      description: "User associated with the communication when known",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

commsMessageSchema.plugin(createdUpdatedPlugin);
commsMessageSchema.plugin(isDeletedPlugin);

commsMessageSchema.index({channel: 1, created: -1});
commsMessageSchema.index({created: -1, status: 1});
commsMessageSchema.index({created: -1, userId: 1});

commsMessageSchema.statics.logSend = async function (
  this: CommsMessageModel,
  params: LogSendParams
): Promise<CommsMessageDocument | undefined> {
  try {
    return await this.create(params);
  } catch (error) {
    logger.catch(error);
    return undefined;
  }
};

export const CommsMessage = mongoose.model<CommsMessageDocument, CommsMessageModel>(
  "CommsMessage",
  commsMessageSchema
);
