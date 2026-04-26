import mongoose from "mongoose";
import type {TodoDocument, TodoModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const todoSchema = new mongoose.Schema<TodoDocument, TodoModel>(
  {
    completed: {
      default: false,
      description: "Whether the todo item has been completed",
      type: Boolean,
    },
    ownerId: {
      description: "The user who owns this todo",
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    priority: {
      description: "Priority level of the todo",
      enum: ["low", "medium", "high"],
      type: String,
    },
    tags: {
      default: [],
      description: "Free-form tags for categorization",
      type: [String],
    },
    title: {
      description: "The title of the todo item",
      required: true,
      trim: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins(todoSchema);

export const Todo = mongoose.model<TodoDocument, TodoModel>("Todo", todoSchema);
