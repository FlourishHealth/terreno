import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {GptHistoryDocument, GptHistoryModel} from "../types";

const contentPartSchema = new mongoose.Schema(
  {
    filename: {description: "Original filename for file-type content parts", type: String},
    mimeType: {description: "MIME type of the file or image content", type: String},
    text: {description: "Text content for text-type parts", type: String},
    type: {
      description: "The kind of content this part represents",
      enum: ["text", "image", "file"],
      required: true,
      type: String,
    },
    url: {description: "URL for image or file content", type: String},
  },
  {_id: false}
);

const gptHistoryPromptSchema = new mongoose.Schema(
  {
    args: {
      description: "Arguments passed when invoking a tool call",
      type: mongoose.Schema.Types.Mixed,
    },
    content: {
      description: "Structured content parts for multimodal messages",
      type: [contentPartSchema],
    },
    model: {description: "AI model identifier used to generate this message", type: String},
    rating: {
      description: "User feedback rating for this prompt",
      enum: ["up", "down"],
      type: String,
    },
    result: {
      description: "Result returned from a tool invocation",
      type: mongoose.Schema.Types.Mixed,
    },
    text: {
      description: "Text content of the prompt or response message",
      required: true,
      type: String,
    },
    toolCallId: {description: "Unique identifier linking a tool call to its result", type: String},
    toolName: {description: "Name of the tool that was called", type: String},
    type: {
      description: "Role of this message in the conversation",
      enum: ["user", "assistant", "system", "tool-call", "tool-result"],
      required: true,
      type: String,
    },
  },
  {_id: false}
);

const gptHistorySchema = new mongoose.Schema<GptHistoryDocument, GptHistoryModel>(
  {
    projectId: {
      description: "Project this conversation belongs to",
      index: true,
      ref: "Project",
      type: mongoose.Schema.Types.ObjectId,
    },
    prompts: {
      default: [],
      description: "Ordered list of conversation messages",
      type: [gptHistoryPromptSchema],
    },
    title: {
      description: "Display title auto-generated from the first assistant response",
      type: String,
    },
    userId: {
      description: "The user who owns this conversation history",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

gptHistorySchema.plugin(createdUpdatedPlugin);
gptHistorySchema.plugin(isDeletedPlugin);
gptHistorySchema.plugin(findOneOrNone);
gptHistorySchema.plugin(findExactlyOne);

// Virtual ownerId alias so Permissions.IsOwner works with userId field
gptHistorySchema.virtual("ownerId").get(function () {
  return this.userId;
});

export const GptHistory = mongoose.model<GptHistoryDocument, GptHistoryModel>(
  "GptHistory",
  gptHistorySchema
);
