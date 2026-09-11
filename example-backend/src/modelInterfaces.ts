import type mongoose from "mongoose";

// Base types for all models
interface BaseDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminAuditLogDocument extends BaseDocument {
  actorId?: mongoose.Types.ObjectId;
  modelName: string;
  recordId?: mongoose.Types.ObjectId;
  recordLabel?: string;
  verb: "created" | "deleted" | "updated";
}

export interface AdminAuditLogModel extends mongoose.Model<AdminAuditLogDocument> {}
