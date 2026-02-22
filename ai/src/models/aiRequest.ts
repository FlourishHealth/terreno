import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {AIRequestDocument, AIRequestModel, LogRequestParams} from "../types";

const aiRequestSchema = new mongoose.Schema<AIRequestDocument, AIRequestModel>(
  {
    aiModel: {
      description: "The AI model identifier used for this request",
      required: true,
      type: String,
    },
    error: {description: "Error message if the request failed", type: String},
    metadata: {
      description: "Additional metadata about the request",
      type: mongoose.Schema.Types.Mixed,
    },
    prompt: {description: "The input prompt sent to the AI model", required: true, type: String},
    requestType: {
      description: "The type of AI request",
      enum: ["general", "remix", "summarization", "translation"],
      required: true,
      type: String,
    },
    response: {description: "The AI model response text", type: String},
    responseTime: {description: "Response time in milliseconds", type: Number},
    tokensUsed: {description: "Total tokens consumed by the request", type: Number},
    userId: {
      description: "The user who made this request",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: true, toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

aiRequestSchema.plugin(createdUpdatedPlugin);
aiRequestSchema.plugin(isDeletedPlugin);
aiRequestSchema.plugin(findOneOrNone);
aiRequestSchema.plugin(findExactlyOne);

aiRequestSchema.index({created: -1, userId: 1});
aiRequestSchema.index({aiModel: 1, created: -1});
aiRequestSchema.index({created: -1, requestType: 1});

(aiRequestSchema.statics as any).logRequest = async function (
  this: AIRequestModel,
  params: LogRequestParams
): Promise<AIRequestDocument> {
  const request = new this(params);
  return request.save();
};

export const AIRequest = mongoose.model<AIRequestDocument, AIRequestModel>(
  "AIRequest",
  aiRequestSchema
);
