import {
  ADMIN_MODEL_ACCESS,
  createAccess,
  OwnerScope,
  persistRbacAuditToAuditEvent,
  terrenoStatements,
} from "@terreno/api";
import mongoose from "mongoose";

import {User} from "./models/user";
import {appDefaultRoles} from "./rbacRoles";

export const appStatements = {
  ...terrenoStatements,
  adminAuditEvent: ADMIN_MODEL_ACCESS,
  adminAuditLog: ["list", "read"],
  adminMcpServiceToken: ADMIN_MODEL_ACCESS,
  adminProject: ADMIN_MODEL_ACCESS,
  adminScreen: ["showcase", "syncLab"],
  adminTodo: ADMIN_MODEL_ACCESS,
  adminUser: ADMIN_MODEL_ACCESS,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

export const access = createAccess({
  auditSink: persistRbacAuditToAuditEvent,
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
