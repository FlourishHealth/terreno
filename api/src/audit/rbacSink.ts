import mongoose from "mongoose";

import type {RbacAuditWrite} from "../rbac/auditModel";
import type {AuditEventOperation, AuditEventVerb} from "./auditEventModel";
import {recordAuditEvent} from "./record";

const RBAC_AUDIT_VERBS: Record<string, AuditEventVerb> = {
  "role.create": "created",
  "role.remove": "deleted",
};

const operationFromVerb = (verb: AuditEventVerb): AuditEventOperation => {
  if (verb === "created") {
    return "create";
  }
  if (verb === "deleted") {
    return "delete";
  }
  return "update";
};

export const persistRbacAuditToAuditEvent = async (record: RbacAuditWrite): Promise<void> => {
  const mappedVerb = RBAC_AUDIT_VERBS[record.action];
  const verb: AuditEventVerb = record.denied || !mappedVerb ? "updated" : mappedVerb;
  const after: Record<string, unknown> = {
    action: record.action,
    denied: record.denied ?? false,
  };
  if (record.permissionDelta?.gained) {
    after.gained = record.permissionDelta.gained;
  }
  const before = record.permissionDelta?.lost ? {lost: record.permissionDelta.lost} : undefined;
  await recordAuditEvent({
    actorId: mongoose.isValidObjectId(record.actorId) ? record.actorId : undefined,
    after,
    before,
    modelName: record.targetRoleName ? "RbacRole" : "User",
    operation: operationFromVerb(verb),
    recordId: record.targetUserId ?? record.targetRoleName,
    recordLabel: record.targetRoleName ?? record.targetUserId,
    source: "rbac",
    verb,
  });
};
