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
    attemptCount: {
      default: 0,
      description: "Number of facade send attempts recorded on this row",
      type: Number,
    },
    attempts: {
      default: [],
      description: "Per-attempt provider results including the inline retry",
      type: [
        {
          _id: false,
          at: {
            description: "When this send attempt ran",
            required: true,
            type: Date,
          },
          error: {
            description: "Provider error message for this attempt",
            type: String,
          },
          errorClass: {
            description: "Classified failure category for this attempt",
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
      ],
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
      description: "Timestamp of the most recent send attempt",
      type: Date,
    },
    metadata: {
      description: "Additional metadata associated with the send attempt",
      type: mongoose.Schema.Types.Mixed,
    },
    payload: {
      description: "Redacted rendered message retained for admin retry",
      type: mongoose.Schema.Types.Mixed,
    },
    payloadExpiresAt: {
      description: "When the retained payload should be cleared",
      index: true,
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
      description: "Admin-dashboard retry that was created from this row",
      ref: "CommsMessage",
      type: mongoose.Schema.Types.ObjectId,
    },
    retriedFromId: {
      description: "Original CommsMessage this admin retry was created from",
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
      description: "Provider or app template identifier used to render the message",
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
    params: {
      attempt: CommsMessageDocument["attempts"][number];
      error?: string;
      errorClass?: CommsMessageDocument["errorClass"];
      errorCode?: string;
      id: mongoose.Types.ObjectId | string;
      metadata?: Record<string, unknown>;
      payload?: unknown;
      payloadExpiresAt?: Date;
      providerMessageId?: string;
      status: CommsMessageDocument["status"];
    }
  ): Promise<CommsMessageDocument | null> {
    let document: CommsMessageDocument | null;
    try {
      document = await this.findOneOrNone({_id: params.id});
      if (!document) {
        return null;
      }
      document.attempts = [...document.attempts, params.attempt];
      document.attemptCount = document.attempts.length;
      document.error = params.error;
      document.errorClass = params.errorClass;
      document.errorCode = params.errorCode;
      document.lastAttemptAt = params.attempt.at;
      document.providerMessageId = params.providerMessageId;
      document.status = params.status;
      if (params.metadata) {
        document.metadata = {...document.metadata, ...params.metadata};
        document.markModified("metadata");
      }
      if (params.payload !== undefined) {
        document.payload = params.payload;
        document.payloadExpiresAt = params.payloadExpiresAt;
      }
      await document.save();
    } catch {
      logger.warn("[comms] Failed to append communication attempt");
      return null;
    }
    await this.clearExpiredPayloads();
    return document;
  },
  async clearExpiredPayloads(this: CommsMessageModel): Promise<number> {
    try {
      const expired = await this.find({
        payload: {$exists: true},
        payloadExpiresAt: {$lte: DateTime.utc().toJSDate()},
      })
        .select("_id")
        .limit(50);
      if (expired.length === 0) {
        return 0;
      }
      const result = await this.updateMany(
        {_id: {$in: expired.map((row) => row._id)}},
        {$unset: {payload: 1, payloadExpiresAt: 1}}
      );
      return result.modifiedCount;
    } catch (error: unknown) {
      logger.warn(`[comms] Failed to clear expired payloads: ${String(error)}`);
      return 0;
    }
  },
  async logSend(
    this: CommsMessageModel,
    params: LogSendParams
  ): Promise<CommsMessageDocument | null> {
    let created: CommsMessageDocument;
    try {
      created = await this.create(params);
    } catch {
      logger.warn("[comms] Failed to record communication send");
      return null;
    }
    await this.clearExpiredPayloads();
    return created;
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
