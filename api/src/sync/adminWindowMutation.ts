import type express from "express";
import mongoose from "mongoose";

import type {ModelRouterOptions} from "../api";
import type {User} from "../auth";
import {APIError} from "../errors";
import {checkPermissions, type PermissionMethod} from "../permissions";
import {findOneOrNoneFor} from "../plugins";
import type {AnyTerrenoAccess} from "../rbac/types";
import {canUseAdminBroadcastWindow} from "./adminWindowAccess";
import type {SyncRegistryEntry} from "./registry";
import type {SyncAppOptions} from "./routes";
import type {SyncMutateRequest, SyncMutationOperation} from "./types";

export interface AdminWindowMutationAuditEvent {
  actorId?: string;
  /** Serialized document after the successful mutation. */
  doc?: Record<string, unknown>;
  modelName: string;
  recordId?: string;
  recordLabel?: string;
  verb: "created" | "deleted" | "updated";
}

export interface AdminWindowMutationScopeHooks {
  preCreate?: ModelRouterOptions<unknown>["preCreate"];
  preUpdate?: ModelRouterOptions<unknown>["preUpdate"];
  preDelete?: ModelRouterOptions<unknown>["preDelete"];
  postCreate?: ModelRouterOptions<unknown>["postCreate"];
  postUpdate?: ModelRouterOptions<unknown>["postUpdate"];
  postDelete?: ModelRouterOptions<unknown>["postDelete"];
}

export interface AdminWindowMutationScope extends AdminWindowMutationScopeHooks {
  /** RBAC access used by AdminApp User admin-flag and role assignment hooks. */
  accessControl?: AnyTerrenoAccess;
  modelName: string;
  permissions: {create: boolean; update: boolean; delete: boolean};
  createPermissions: PermissionMethod<unknown>[];
  updatePermissions: PermissionMethod<unknown>[];
  deletePermissions: PermissionMethod<unknown>[];
  stripMutationData: (data: Record<string, unknown>) => Record<string, unknown>;
  /** Legacy standalone audit callback; prefer `postCreate` / `postUpdate` / `postDelete`. */
  emitAudit?: (args: {
    event: AdminWindowMutationAuditEvent;
    req: express.Request;
  }) => void | Promise<void>;
}

/** Coalesce `req.user.id` and `req.user._id` to match Admin REST audit actor ids. */
export const auditActorIdFromRequest = (req: express.Request): string | undefined => {
  const actor = req.user as {id?: unknown; _id?: unknown} | undefined;
  if (!actor) {
    return undefined;
  }
  if (actor.id != null) {
    return String(actor.id);
  }
  if (actor._id != null) {
    return String(actor._id);
  }
  return undefined;
};

/**
 * Admin-window sync mutations use AdminApp router pre/post hooks, not product `modelRouter`
 * hooks. Product hooks can overwrite stripped or admin-authorized fields (for example by
 * forcing `ownerId` in `preCreate`).
 */
export const buildAdminWindowExecutorOptions = <T>({
  productOptions,
  scope,
}: {
  productOptions: ModelRouterOptions<T>;
  scope: AdminWindowMutationScope;
}): ModelRouterOptions<T> => ({
  ...productOptions,
  accessControl: scope.accessControl ?? productOptions.accessControl,
  postCreate: scope.postCreate as ModelRouterOptions<T>["postCreate"],
  postDelete: scope.postDelete as ModelRouterOptions<T>["postDelete"],
  postUpdate: scope.postUpdate as ModelRouterOptions<T>["postUpdate"],
  preCreate: scope.preCreate as ModelRouterOptions<T>["preCreate"],
  preDelete: scope.preDelete as ModelRouterOptions<T>["preDelete"],
  preUpdate: scope.preUpdate as ModelRouterOptions<T>["preUpdate"],
});

/** Ensure `req.params.id` is set for AdminApp update/delete hooks (User admin-flag gates). */
export const withAdminWindowMutationRequestContext = ({
  mutation,
  req,
}: {
  mutation: SyncMutateRequest;
  req: express.Request;
}): express.Request => {
  if (mutation.operation === "create" || mutation.id == null) {
    return req;
  }
  const params = {...(req.params ?? {}), id: mutation.id};
  return Object.assign(req, {params}) as express.Request;
};

const adminWindowMutationScopes = new Map<string, AdminWindowMutationScope>();

export const registerAdminWindowMutationScope = (
  modelName: string,
  scope: AdminWindowMutationScope
): void => {
  adminWindowMutationScopes.set(modelName, scope);
};

export const getAdminWindowMutationScope = (
  modelName: string
): AdminWindowMutationScope | undefined => adminWindowMutationScopes.get(modelName);

export const clearAdminWindowMutationScopes = (): void => {
  adminWindowMutationScopes.clear();
};

const operationEnabled = (
  scope: AdminWindowMutationScope,
  operation: SyncMutationOperation
): boolean => {
  if (operation === "create") {
    return scope.permissions.create;
  }
  if (operation === "update") {
    return scope.permissions.update;
  }
  return scope.permissions.delete;
};

const permissionsForOperation = (
  scope: AdminWindowMutationScope,
  operation: SyncMutationOperation
): PermissionMethod<unknown>[] => {
  if (operation === "create") {
    return scope.createPermissions;
  }
  if (operation === "update") {
    return scope.updatePermissions;
  }
  return scope.deletePermissions;
};

const loadInstance = async ({
  entry,
  id,
}: {
  entry: SyncRegistryEntry;
  id: string;
}): Promise<unknown> => {
  const model = mongoose.model(entry.modelName);
  return findOneOrNoneFor(model, {_id: id, deleted: {$in: [true, false]}});
};

/**
 * Validates an explicit `mutationMode: "adminWindow"` marker and applies AdminApp write
 * semantics before the product sync executor runs. Returns the mutation with stripped
 * data, or `undefined` when the request stays on the product path.
 *
 * The marker alone is never trusted: callers must also have admin-window access, the
 * collection must be `adminBroadcast`, and AdminApp must have registered a write scope.
 */
export const prepareAdminWindowMutation = async ({
  entry,
  mutation,
  req: _req,
  syncOptions,
  user,
}: {
  entry: SyncRegistryEntry;
  mutation: SyncMutateRequest;
  req: express.Request;
  syncOptions?: SyncAppOptions;
  user: User;
}): Promise<{mutation: SyncMutateRequest; scope: AdminWindowMutationScope} | undefined> => {
  if (mutation.mutationMode !== "adminWindow") {
    return undefined;
  }
  if (!entry.config.adminBroadcast) {
    throw new APIError({
      status: 403,
      title: "Admin window mutations require an adminBroadcast collection",
    });
  }
  if (
    !(await canUseAdminBroadcastWindow({
      accessControl: syncOptions?.accessControl,
      canOpenAdminWindow: syncOptions?.canOpenAdminWindow,
      user,
    }))
  ) {
    throw new APIError({status: 403, title: "Admin window access required"});
  }
  const scope = getAdminWindowMutationScope(entry.modelName);
  if (!scope) {
    throw new APIError({
      status: 403,
      title: "Admin window mutations are not registered for this collection",
    });
  }
  if (!operationEnabled(scope, mutation.operation)) {
    throw new APIError({
      status: 403,
      title: `${mutation.operation} is disabled for this admin model`,
    });
  }

  let instance: unknown;
  if (mutation.operation !== "create") {
    if (!mutation.id) {
      throw new APIError({
        status: 400,
        title: `id is required for ${mutation.operation} mutations`,
      });
    }
    instance = await loadInstance({entry, id: mutation.id});
    if (!instance && mutation.operation === "update") {
      throw new APIError({status: 404, title: "Not found"});
    }
  }

  const permissionMethod =
    mutation.operation === "create"
      ? "create"
      : mutation.operation === "update"
        ? "update"
        : "delete";
  const permissionInstance =
    mutation.operation === "create" ? (mutation.data as unknown) : instance;
  if (
    !(await checkPermissions(
      permissionMethod,
      permissionsForOperation(scope, mutation.operation),
      user,
      permissionInstance
    ))
  ) {
    throw new APIError({status: 403, title: "Admin write access denied"});
  }

  if (mutation.operation === "delete" || !mutation.data) {
    return {mutation, scope};
  }
  return {
    mutation: {...mutation, data: scope.stripMutationData(mutation.data)},
    scope,
  };
};

export const emitAdminWindowMutationAudit = async ({
  doc,
  mutation,
  req,
  scope,
}: {
  doc: mongoose.Document;
  mutation: SyncMutateRequest;
  req: express.Request;
  scope: AdminWindowMutationScope;
}): Promise<void> => {
  if (!scope.emitAudit) {
    return;
  }
  const plain = doc.toObject() as Record<string, unknown>;
  const recordId = plain._id != null ? String(plain._id) : mutation.id;
  const verb =
    mutation.operation === "create"
      ? "created"
      : mutation.operation === "delete"
        ? "deleted"
        : "updated";
  await scope.emitAudit({
    event: {
      actorId: auditActorIdFromRequest(req),
      doc: plain,
      modelName: scope.modelName,
      recordId,
      verb,
    },
    req,
  });
};
