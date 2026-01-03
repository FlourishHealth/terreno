import mongoose from "mongoose";
import type {TodoDocument, TodoModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const todoSchema = new mongoose.Schema<TodoDocument, TodoModel>(
  {
    completed: {
      default: false,
      type: Boolean,
    },
    ownerId: {
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    title: {
      required: true,
      trim: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins(todoSchema);

export const Todo = mongoose.model<TodoDocument, TodoModel>("Todo", todoSchema);


