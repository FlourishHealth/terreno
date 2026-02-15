import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {AIRequestDocument, AIRequestModel, LogRequestParams} from "../types";

const aiRequestSchema = new mongoose.Schema<AIRequestDocument, AIRequestModel>(
  {
    aiModel: {required: true, type: String},
    error: {type: String},
    metadata: {type: mongoose.Schema.Types.Mixed},
    prompt: {required: true, type: String},
    requestType: {
      enum: ["general", "remix", "summarization", "translation"],
      required: true,
      type: String,
    },
    response: {type: String},
    responseTime: {type: Number},
    tokensUsed: {type: Number},
    userId: {ref: "User", type: mongoose.Schema.Types.ObjectId},
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
