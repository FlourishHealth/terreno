import type {User} from "../auth";
import {checkPermissions} from "../permissions";
import type {RealtimeRegistryEntry} from "../realtime/registry";
import {applyReadMask} from "./fieldViews";
import type {RESTMethod} from "../api";

const resolveListAction = (entry: RealtimeRegistryEntry): string => {
  const access = entry.options.access;
  const accessControl = entry.options.accessControl;
  if (!access || !accessControl) {
    return "read";
  }
  const statements = accessControl.statements as Record<string, readonly string[]>;
  const resourceActions = statements[access.resource] ?? [];
  if (resourceActions.includes("list")) {
    return "list";
  }
  return "read";
};

export const canSubscribeRealtime = async (
  entry: RealtimeRegistryEntry,
  method: "list" | "read",
  user?: User,
): Promise<boolean> => {
  const access = entry.options.access;
  const accessControl = entry.options.accessControl;
  if (access && accessControl) {
    const action = method === "list" ? resolveListAction(entry) : "read";
    const result = await accessControl.can({
      context: {transport: "socket"},
      permissions: {[access.resource]: [action]},
      user,
    });
    return result.allowed;
  }

  const permissions = entry.options.permissions?.[method] ?? [];
  return checkPermissions(method, permissions, user);
};

export const canReadDocumentRealtime = async (
  entry: RealtimeRegistryEntry,
  user?: User,
  doc?: Record<string, unknown>,
): Promise<boolean> => {
  const access = entry.options.access;
  const accessControl = entry.options.accessControl;
  if (access && accessControl) {
    const result = await accessControl.can({
      context: {transport: "socket"},
      doc,
      permissions: {[access.resource]: ["read"]},
      user,
    });
    return result.allowed;
  }

  return checkPermissions("read", entry.options.permissions?.read ?? [], user, doc);
};

export const maskRealtimeDocument = async (
  entry: RealtimeRegistryEntry,
  user: User | undefined,
  doc: unknown,
  method: RESTMethod,
): Promise<unknown> => {
  const access = entry.options.access;
  const accessControl = entry.options.accessControl;
  if (!access || !accessControl) {
    return doc;
  }

  const phase = method === "create" ? "create" : "read";
  const mask = await accessControl.fieldMask({
    doc,
    phase,
    resource: access.resource,
    user,
  });
  return applyReadMask(doc, mask);
};
