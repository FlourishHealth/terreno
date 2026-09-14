import {
  ADMIN_MODEL_ACCESS,
  createAccess,
  OwnerScope,
  type RbacAuditWrite,
  terrenoStatements,
} from "@terreno/api";
import mongoose from "mongoose";

import {AdminAuditLog} from "./models/adminAuditLog";
import {User} from "./models/user";
import {appDefaultRoles} from "./rbacRoles";

export const appStatements = {
  ...terrenoStatements,
  adminAdminAuditLog: ADMIN_MODEL_ACCESS,
  adminAuditLog: ["list", "read"],
  adminMcpServiceToken: ADMIN_MODEL_ACCESS,
  adminProject: ADMIN_MODEL_ACCESS,
  adminScreen: ["showcase", "syncLab"],
  adminTodo: ADMIN_MODEL_ACCESS,
  adminUser: ADMIN_MODEL_ACCESS,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const RBAC_ADMIN_AUDIT_VERBS: Record<string, "created" | "deleted" | "updated"> = {
  "role.create": "created",
  "role.remove": "deleted",
};

const persistRbacAuditToAdminLog = async (record: RbacAuditWrite): Promise<void> => {
  const mappedVerb = RBAC_ADMIN_AUDIT_VERBS[record.action];
  const verb = record.denied || !mappedVerb ? "updated" : mappedVerb;
  await AdminAuditLog.create({
    actorId: mongoose.isValidObjectId(record.actorId)
      ? new mongoose.Types.ObjectId(record.actorId)
      : undefined,
    modelName: record.targetRoleName ? "RbacRole" : "User",
    recordLabel: record.targetRoleName ?? record.targetUserId,
    verb,
  });
};

export const access = createAccess({
  auditSink: persistRbacAuditToAdminLog,
  connection: mongoose.connection,
  defaultRoles: appDefaultRoles,
  scopes: {
    "todo.delete": OwnerScope(),
    "todo.list": OwnerScope(),
    "todo.read": OwnerScope(),
    "todo.update": OwnerScope(),
  },
  statements: appStatements,
  userModel: User as unknown as import("@terreno/api").UserModel,
});
