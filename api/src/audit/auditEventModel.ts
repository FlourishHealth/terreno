import mongoose from "mongoose";

import {createdUpdatedPlugin, findExactlyOne, findOneOrNone} from "../plugins";

export type AuditEventVerb = "created" | "deleted" | "updated";
export type AuditEventSource = "admin" | "modelRouter" | "rbac";
export type AuditEventOperation =
  | "arrayPush"
  | "arrayRemove"
  | "arrayUpdate"
  | "create"
  | "delete"
  | "update";

export interface AuditEventDocument {
  _id: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId;
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  created: Date;
  modelName: string;
  operation: AuditEventOperation;
  organizationId?: string;
  recordId?: string;
  recordLabel?: string;
  source: AuditEventSource;
  updated: Date;
  verb: AuditEventVerb;
}

export type AuditEventModel = mongoose.Model<AuditEventDocument>;

const auditEventSchema = new mongoose.Schema<AuditEventDocument, AuditEventModel>(
  {
    actorId: {
      description: "User who performed the mutation, when known",
      index: true,
      ref: "User",
      type: mongoose.Schema.Types.ObjectId,
    },
    after: {
      description: "Redacted changed fields after the mutation",
      type: mongoose.Schema.Types.Mixed,
    },
    before: {
      description: "Redacted changed fields before the mutation",
      type: mongoose.Schema.Types.Mixed,
    },
    modelName: {
      description: "Mongoose model name of the affected document",
      index: true,
      required: true,
      trim: true,
      type: String,
    },
    operation: {
      description: "Fine-grained mutation kind",
      enum: ["arrayPush", "arrayRemove", "arrayUpdate", "create", "delete", "update"],
      required: true,
      type: String,
    },
    organizationId: {
      description: "Tenant organization id when known",
      index: true,
      type: String,
    },
    recordId: {
      description: "Primary key of the affected document",
      index: true,
      type: String,
    },
    recordLabel: {
      description: "Short human-readable label for the affected record",
      trim: true,
      type: String,
    },
    source: {
      description: "Which framework surface wrote this event",
      enum: ["admin", "modelRouter", "rbac"],
      index: true,
      required: true,
      type: String,
    },
    verb: {
      description: "Widget-compatible mutation verb",
      enum: ["created", "deleted", "updated"],
      index: true,
      required: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

auditEventSchema.index({created: -1});
auditEventSchema.index({created: -1, modelName: 1, recordId: 1});
auditEventSchema.plugin(createdUpdatedPlugin);
auditEventSchema.plugin(findOneOrNone);
auditEventSchema.plugin(findExactlyOne);

export const createAuditEventModel = (connection: mongoose.Connection): AuditEventModel => {
  if (connection.models.AuditEvent) {
    return connection.models.AuditEvent as AuditEventModel;
  }
  return connection.model<AuditEventDocument, AuditEventModel>("AuditEvent", auditEventSchema);
};
