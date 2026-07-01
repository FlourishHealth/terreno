import mongoose from "mongoose";
import type {TodoListDocument, TodoListModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const todoListSchema = new mongoose.Schema<TodoListDocument, TodoListModel>(
  {
    color: {
      description: "Optional display color (hex) for the list",
      type: String,
    },
    name: {
      description: "Display name of the todo list",
      required: true,
      trim: true,
      type: String,
    },
    ownerId: {
      description: "The user who owns this list",
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins(todoListSchema);

export const TodoList = mongoose.model<TodoListDocument, TodoListModel>("TodoList", todoListSchema);
