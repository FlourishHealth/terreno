import mongoose from "mongoose";

import type {AdminAuditLogDocument, AdminAuditLogModel} from "../modelInterfaces";
import {addDefaultPlugins} from "./modelPlugins";

const adminAuditLogSchema = new mongoose.Schema<AdminAuditLogDocument, AdminAuditLogModel>(
  {
    actorId: {
      description: "User who performed the action",
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
    modelName: {
      description: "Mongoose model name affected",
      index: true,
      required: true,
      trim: true,
      type: String,
    },
    recordId: {
      description: "Primary key of the affected document",
      index: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    recordLabel: {
      description: "Human-readable label for the record",
      trim: true,
      type: String,
    },
    verb: {
      description: "Mutation kind",
      enum: ["created", "deleted", "updated"],
      index: true,
      required: true,
      type: String,
    },
  },
  {strict: "throw", timestamps: true, toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

adminAuditLogSchema.index({createdAt: -1});

addDefaultPlugins(adminAuditLogSchema);

export const AdminAuditLog = mongoose.model("AdminAuditLog", adminAuditLogSchema);
