import mongoose from "mongoose";
import type {TodoCommentDocument, TodoCommentModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const todoCommentSchema = new mongoose.Schema<TodoCommentDocument, TodoCommentModel>(
  {
    ownerId: {
      description: "The user who authored this comment",
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    text: {
      description: "The comment body",
      required: true,
      trim: true,
      type: String,
    },
    todoId: {
      description: "The todo this comment belongs to",
      ref: "Todo",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins(todoCommentSchema);

export const TodoComment = mongoose.model<TodoCommentDocument, TodoCommentModel>(
  "TodoComment",
  todoCommentSchema
);
