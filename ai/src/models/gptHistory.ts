import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {GptHistoryDocument, GptHistoryModel} from "../types";

const gptHistoryPromptSchema = new mongoose.Schema(
  {
    model: {type: String},
    text: {required: true, type: String},
    type: {enum: ["user", "assistant", "system"], required: true, type: String},
  },
  {_id: false}
);

const gptHistorySchema = new mongoose.Schema<GptHistoryDocument, GptHistoryModel>(
  {
    prompts: {default: [], type: [gptHistoryPromptSchema]},
    title: {type: String},
    userId: {index: true, ref: "User", required: true, type: mongoose.Schema.Types.ObjectId},
  },
  {strict: true, toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

gptHistorySchema.plugin(createdUpdatedPlugin);
gptHistorySchema.plugin(isDeletedPlugin);
gptHistorySchema.plugin(findOneOrNone);
gptHistorySchema.plugin(findExactlyOne);

// Virtual ownerId alias so Permissions.IsOwner works with userId field
gptHistorySchema.virtual("ownerId").get(function () {
  return this.userId;
});

gptHistorySchema.pre("save", function () {
  if (!this.title && this.prompts && this.prompts.length > 0) {
    const firstAssistant = this.prompts.find((p) => p.type === "assistant");
    if (firstAssistant) {
      this.title = firstAssistant.text.substring(0, 50);
    }
  }
});

export const GptHistory = mongoose.model<GptHistoryDocument, GptHistoryModel>(
  "GptHistory",
  gptHistorySchema
);
