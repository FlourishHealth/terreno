import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import mongoose from "mongoose";

import type {ProjectDocument, ProjectModel} from "../types";

const memorySchema = new mongoose.Schema(
  {
    category: {description: "Optional grouping category for this memory", type: String},
    source: {
      default: "user",
      description: "How this memory was created",
      enum: ["user", "auto"],
      type: String,
    },
    text: {description: "The memory content", required: true, type: String},
  },
  {timestamps: {createdAt: "created", updatedAt: false}}
);

const projectSchema = new mongoose.Schema<ProjectDocument, ProjectModel>(
  {
    memories: {
      default: [],
      description: "Persistent memories for this project",
      type: [memorySchema],
    },
    name: {description: "Project name", required: true, type: String},
    systemContext: {
      default: "",
      description: "Persistent system instructions prepended to every conversation in this project",
      type: String,
    },
    userId: {
      description: "The user who owns this project",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

projectSchema.plugin(createdUpdatedPlugin);
projectSchema.plugin(isDeletedPlugin);
projectSchema.plugin(findOneOrNone);
projectSchema.plugin(findExactlyOne);

// Virtual ownerId alias so Permissions.IsOwner works with userId field
projectSchema.virtual("ownerId").get(function () {
  return this.userId;
});

export const Project = mongoose.model<ProjectDocument, ProjectModel>("Project", projectSchema);
