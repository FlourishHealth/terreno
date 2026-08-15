import {
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
  logger,
} from "@terreno/api";
import mongoose from "mongoose";

import type {
  CommsMessageDocument,
  CommsMessageModel,
  CommsMessageSchema,
  LogSendParams,
} from "../modelTypes";

const commsMessageSchema: CommsMessageSchema = new mongoose.Schema<
  CommsMessageDocument,
  CommsMessageModel
>(
  {
    channel: {
      description: "Communication channel used for the send attempt",
      enum: ["mail", "push", "sms", "verification"],
      required: true,
      type: String,
    },
    error: {
      description: "Provider error returned for a failed send attempt",
      type: String,
    },
    metadata: {
      description: "Additional metadata associated with the send attempt",
      type: mongoose.Schema.Types.Mixed,
    },
    provider: {
      description: "Identifier of the provider handling the send attempt",
      minlength: 1,
      required: true,
      type: String,
    },
    providerMessageId: {
      description: "Provider-assigned identifier for delivery tracking",
      index: true,
      type: String,
    },
    status: {
      description: "Current delivery status of the communication",
      enum: ["bounced", "delivered", "failed", "sent"],
      required: true,
      type: String,
    },
    subject: {
      description: "Mail subject when the communication channel is mail",
      type: String,
    },
    to: {
      description: "Recipient identifier for the communication",
      required: true,
      type: String,
    },
    userId: {
      description: "User associated with the communication",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

commsMessageSchema.statics = {
  async logSend(
    this: CommsMessageModel,
    params: LogSendParams
  ): Promise<CommsMessageDocument | null> {
    try {
      return await this.create(params);
    } catch {
      logger.warn("[comms] Failed to record communication send");
      return null;
    }
  },
};

commsMessageSchema.plugin(createdUpdatedPlugin);
commsMessageSchema.plugin(isDeletedPlugin);
commsMessageSchema.plugin(findOneOrNone);
commsMessageSchema.plugin(findExactlyOne);

commsMessageSchema.index({channel: 1, created: -1});
commsMessageSchema.index({created: -1, status: 1});
commsMessageSchema.index({created: -1, userId: 1});

export const CommsMessage = mongoose.model<CommsMessageDocument, CommsMessageModel>(
  "CommsMessage",
  commsMessageSchema
);
