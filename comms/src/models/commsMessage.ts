import {
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
  logger,
} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import type {
  AppendAttemptParams,
  CommsMessageDocument,
  CommsMessageModel,
  CommsMessageSchema,
  LogSendParams,
} from "../modelTypes";

const EXPIRED_PAYLOAD_BATCH_SIZE = 50;

const attemptSubSchema = new mongoose.Schema(
  {
    at: {
      description: "When this provider attempt ran",
      required: true,
      type: Date,
    },
    error: {
      description: "Provider error message for this attempt",
      type: String,
    },
    errorClass: {
      description: "Failure class for this attempt",
      enum: ["config", "permanent", "transient"],
      type: String,
    },
    errorCode: {
      description: "Provider-native error code for this attempt",
      type: String,
    },
    provider: {
      description: "Provider identifier used for this attempt",
      required: true,
      type: String,
    },
    providerMessageId: {
      description: "Provider-assigned identifier returned by this attempt",
      type: String,
    },
  },
  {_id: false}
);

const commsMessageSchema: CommsMessageSchema = new mongoose.Schema<
  CommsMessageDocument,
  CommsMessageModel
>(
  {
    attemptCount: {
      default: 0,
      description: "Number of provider attempts recorded on this row",
      type: Number,
    },
    attempts: {
      default: [],
      description: "Per-attempt history including the inline transient retry",
      type: [attemptSubSchema],
    },
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
    errorClass: {
      description: "Classified failure category used for retry eligibility",
      enum: ["config", "permanent", "transient"],
      type: String,
    },
    errorCode: {
      description: "Provider-native error code for a failed send attempt",
      index: true,
      type: String,
    },
    lastAttemptAt: {
      description: "Timestamp of the most recent provider attempt",
      type: Date,
    },
    metadata: {
      description: "Additional metadata associated with the send attempt",
      type: mongoose.Schema.Types.Mixed,
    },
    payload: {
      description: "Redacted rendered payload retained for admin retry",
      type: mongoose.Schema.Types.Mixed,
    },
    payloadExpiresAt: {
      description: "When the retained payload should be cleared",
      type: Date,
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
    retriedById: {
      description: "Admin retry row created from this message",
      ref: "CommsMessage",
      type: mongoose.Schema.Types.ObjectId,
    },
    retriedFromId: {
      description: "Original message this admin retry was created from",
      ref: "CommsMessage",
      type: mongoose.Schema.Types.ObjectId,
    },
    status: {
      description: "Current delivery status of the communication",
      enum: ["bounced", "cancelled", "delivered", "failed", "sent"],
      required: true,
      type: String,
    },
    subject: {
      description: "Mail subject when the communication channel is mail",
      type: String,
    },
    templateId: {
      description: "Optional template identifier used to render the message",
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
  async appendAttempt(
    this: CommsMessageModel,
    params: AppendAttemptParams
  ): Promise<CommsMessageDocument | null> {
    if (!params.messageId) {
      logger.warn("[comms] Failed to append communication attempt");
      return null;
    }
    try {
      const message = await this.findOneOrNone({_id: params.messageId});
      if (!message) {
        logger.warn("[comms] Failed to append communication attempt");
        return null;
      }
      await this.clearExpiredPayloads();
      message.attempts = [...(message.attempts ?? []), params.attempt];
      message.attemptCount = message.attempts.length;
      message.lastAttemptAt = params.attempt.at;
      message.status = params.status;
      message.error = params.error;
      message.errorClass = params.errorClass;
      message.errorCode = params.errorCode;
      message.providerMessageId = params.providerMessageId;
      await message.save();
      return message;
    } catch {
      logger.warn("[comms] Failed to append communication attempt");
      return null;
    }
  },
  async clearExpiredPayloads(this: CommsMessageModel): Promise<number> {
    try {
      const expired = await this.find({
        payload: {$exists: true, $ne: null},
        payloadExpiresAt: {$lte: DateTime.utc().toJSDate()},
      })
        .select("_id")
        .limit(EXPIRED_PAYLOAD_BATCH_SIZE);
      if (expired.length === 0) {
        return 0;
      }
      const result = await this.updateMany(
        {_id: {$in: expired.map((row) => row._id)}},
        {$unset: {payload: 1}}
      );
      return result.modifiedCount;
    } catch {
      logger.warn("[comms] Failed to clear expired communication payloads");
      return 0;
    }
  },
  async logSend(
    this: CommsMessageModel,
    params: LogSendParams
  ): Promise<CommsMessageDocument | null> {
    try {
      await this.clearExpiredPayloads();
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
commsMessageSchema.index({payloadExpiresAt: 1});

export const CommsMessage = mongoose.model<CommsMessageDocument, CommsMessageModel>(
  "CommsMessage",
  commsMessageSchema
);
