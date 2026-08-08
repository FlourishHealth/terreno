import mongoose from "mongoose";

import {createdUpdatedPlugin, findExactlyOne, findOneOrNone} from "../plugins";
import type {PermissionSet} from "./statements";

export interface RbacAuditDocument {
  _id: mongoose.Types.ObjectId;
  action: string;
  actorId: string;
  targetRoleName?: string;
  targetUserId?: string;
  permissionDelta?: {
    gained: PermissionSet;
    lost: PermissionSet;
  };
  denied: boolean;
  created: Date;
  updated: Date;
}

export type RbacAuditModel = mongoose.Model<RbacAuditDocument>;

const rbacAuditSchema = new mongoose.Schema<RbacAuditDocument, RbacAuditModel>(
  {
    action: {
      description: "RBAC action that was attempted or performed",
      required: true,
      type: String,
    },
    actorId: {
      description: "User id of the actor who performed the action",
      index: true,
      required: true,
      type: String,
    },
    denied: {
      default: false,
      description: "Whether the action was denied (e.g. escalation attempt)",
      type: Boolean,
    },
    permissionDelta: {
      description: "Permissions gained and lost by the change",
      type: mongoose.Schema.Types.Mixed,
    },
    targetRoleName: {
      description: "Role name affected by the action",
      index: true,
      type: String,
    },
    targetUserId: {
      description: "User id affected by the action",
      index: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

rbacAuditSchema.plugin(createdUpdatedPlugin);
rbacAuditSchema.plugin(findOneOrNone);
rbacAuditSchema.plugin(findExactlyOne);

export const createRbacAuditModel = (connection: mongoose.Connection): RbacAuditModel => {
  if (connection.models.RbacAudit) {
    return connection.models.RbacAudit as RbacAuditModel;
  }
  return connection.model<RbacAuditDocument, RbacAuditModel>("RbacAudit", rbacAuditSchema);
};

export const RbacAuditModel = createRbacAuditModel(mongoose.connection);
