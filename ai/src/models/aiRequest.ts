import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {
  AIRequestDocument,
  AIRequestModel,
  LogMultiAgentRequestParams,
  LogRequestParams,
} from "../types";

const aiRequestSchema = new mongoose.Schema<AIRequestDocument, AIRequestModel>(
  {
    aiModel: {required: true, type: String},
    error: {type: String},
    metadata: {type: mongoose.Schema.Types.Mixed},
    parentRequestId: {ref: "AIRequest", type: mongoose.Schema.Types.ObjectId},
    prompt: {required: true, type: String},
    requestType: {
      required: true,
      type: String,
    },
    response: {type: String},
    responseTime: {type: Number},
    subRequestIds: [{ref: "AIRequest", type: mongoose.Schema.Types.ObjectId}],
    tokensUsed: {type: Number},
    totalResponseTime: {type: Number},
    totalTokensUsed: {type: Number},
    userId: {ref: "User", type: mongoose.Schema.Types.ObjectId},
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

aiRequestSchema.plugin(createdUpdatedPlugin);
aiRequestSchema.plugin(isDeletedPlugin);
aiRequestSchema.plugin(findOneOrNone);
aiRequestSchema.plugin(findExactlyOne);

aiRequestSchema.index({created: -1, userId: 1});
aiRequestSchema.index({aiModel: 1, created: -1});
aiRequestSchema.index({created: -1, requestType: 1});
aiRequestSchema.index({parentRequestId: 1});

(aiRequestSchema.statics as any).logRequest = async function (
  this: AIRequestModel,
  params: LogRequestParams
): Promise<AIRequestDocument> {
  const request = new this(params);
  return request.save();
};

(aiRequestSchema.statics as any).logMultiAgentRequest = async function (
  this: AIRequestModel,
  params: LogMultiAgentRequestParams
): Promise<AIRequestDocument> {
  const parent = await this.create({
    aiModel: params.aiModel,
    metadata: params.metadata ?? {},
    prompt: "[multi-agent parent request]",
    requestType: params.requestType,
    response: "",
    subRequestIds: params.subRequestIds,
    totalResponseTime: params.totalResponseTime,
    totalTokensUsed: params.totalTokensUsed,
    userId: params.userId,
  });

  await this.updateMany({_id: {$in: params.subRequestIds}}, {$set: {parentRequestId: parent._id}});

  return parent;
};

export const AIRequest = mongoose.model<AIRequestDocument, AIRequestModel>(
  "AIRequest",
  aiRequestSchema
);
