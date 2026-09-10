import type {User} from "../auth";
import {logger} from "../logger";
import type {PermissionMethod} from "../permissions";
import {checkPermissions} from "../permissions";
import {matchesQuery} from "../realtime/queryMatcher";
import {adminBroadcastStream} from "./streams";

/**
 * AdminApp row/resource rules for `{collection}|admin` and admin-window
 * `GET /sync/entities`. Product `queryFilter` / `IsOwner` stay on app streams;
 * this registry is the AdminApp list/read contract (resource actions + tenant
 * `queryFilter`) so a panel user cannot fetch or live-stream rows `/admin` REST
 * would hide.
 */
export interface AdminBroadcastScope {
  listPermissions: PermissionMethod<unknown>[];
  queryFilter?: (
    user?: User,
    query?: Record<string, unknown>
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  readPermissions: PermissionMethod<unknown>[];
}

const adminBroadcastScopes = new Map<string, AdminBroadcastScope>();

export const registerAdminBroadcastScope = (
  modelName: string,
  scope: AdminBroadcastScope
): void => {
  adminBroadcastScopes.set(modelName, scope);
};

export const getAdminBroadcastScope = (modelName: string): AdminBroadcastScope | undefined =>
  adminBroadcastScopes.get(modelName);

export const clearAdminBroadcastScopes = (): void => {
  adminBroadcastScopes.clear();
};

/** Socket.io room for `{collection}|admin` (`sync:{tag}|admin`). */
export const isAdminBroadcastSocketRoom = (room: string, collectionTag: string): boolean =>
  room === `sync:${adminBroadcastStream(collectionTag)}`;

const compactFilter = (filter: Record<string, unknown>): Record<string, unknown> | undefined => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

export const resolveAdminBroadcastQueryFilter = async ({
  scope,
  user,
}: {
  scope: AdminBroadcastScope;
  user: User;
}): Promise<{denied: boolean; filter?: Record<string, unknown>}> => {
  if (!scope.queryFilter) {
    return {denied: false};
  }
  let resolved: Record<string, unknown> | null;
  try {
    resolved = await scope.queryFilter(user, {});
  } catch (error: unknown) {
    logger.error("[sync] admin broadcast queryFilter threw; denying the read", {
      error: String(error),
      userId: String(user.id),
    });
    return {denied: true};
  }
  if (resolved === null) {
    return {denied: true};
  }
  return {denied: false, filter: compactFilter(resolved)};
};

export const canListAdminBroadcastScope = async ({
  scope,
  user,
}: {
  scope: AdminBroadcastScope;
  user: User;
}): Promise<boolean> => checkPermissions("list", scope.listPermissions, user);

/**
 * `unscoped` means AdminApp has not registered this model — keep product
 * `IsOwner` / `queryFilter` behavior. `deny` / `allow` replace product read
 * for the admin window.
 */
export const authorizeAdminBroadcastDocument = async ({
  doc,
  modelName,
  user,
}: {
  doc?: Record<string, unknown>;
  modelName: string;
  user?: User;
}): Promise<"allow" | "deny" | "unscoped"> => {
  const scope = getAdminBroadcastScope(modelName);
  if (!scope) {
    return "unscoped";
  }
  if (!user) {
    return "deny";
  }
  if (!(await canListAdminBroadcastScope({scope, user}))) {
    return "deny";
  }
  const filterResult = await resolveAdminBroadcastQueryFilter({scope, user});
  if (filterResult.denied) {
    return "deny";
  }
  if (doc && filterResult.filter && !matchesQuery(doc, filterResult.filter)) {
    return "deny";
  }
  if (doc && !(await checkPermissions("read", scope.readPermissions, user, doc))) {
    return "deny";
  }
  return "allow";
};
