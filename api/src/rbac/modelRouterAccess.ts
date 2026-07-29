import type express from "express";

import {APIError} from "../errors";
import type {PermissionMethod, RESTPermissions} from "../permissions";
import {applyReadMask, getDisallowedWriteKeys} from "./fieldViews";
import {createIsPermitted} from "./middleware";
import type {RESTMethod} from "../api";
import type {
  AnyTerrenoAccess,
  ModelRouterAccessOptions,
  ResourceScope,
} from "./types";

const DEFAULT_METHOD_ACTIONS: Record<RESTMethod, string> = {
  create: "create",
  delete: "delete",
  list: "list",
  read: "read",
  update: "update",
};

const mergeFilters = (
  existing: Record<string, unknown> | null | undefined,
  scopeFilter: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (existing === null || scopeFilter === null) {
    return null;
  }
  if (!existing && !scopeFilter) {
    return {};
  }
  if (!existing) {
    return scopeFilter ?? {};
  }
  if (!scopeFilter || Object.keys(scopeFilter).length === 0) {
    return existing;
  }
  return {$and: [existing, scopeFilter]};
};

const resolveActionForMethod = (
  method: RESTMethod,
  access: ModelRouterAccessOptions,
  statements: Record<string, readonly string[]>,
): string | null => {
  const override = access.actions?.[method];
  if (override === null) {
    return null;
  }
  if (override) {
    return override;
  }

  const resourceActions = statements[access.resource] ?? [];
  if (method === "list" && resourceActions.includes("list")) {
    return "list";
  }
  if (method === "list") {
    return "read";
  }
  return DEFAULT_METHOD_ACTIONS[method];
};

const buildPermissionRequest = (
  resource: string,
  action: string,
): Record<string, string[]> => ({
  [resource]: [action],
});

export const buildAccessPermissions = <T>(
  accessControl: AnyTerrenoAccess,
  access: ModelRouterAccessOptions,
): RESTPermissions<T> => {
  const isPermitted = createIsPermitted({can: accessControl.can});
  const statements = accessControl.statements as Record<string, readonly string[]>;

  const buildMethodPermissions = (method: RESTMethod): PermissionMethod<T>[] => {
    const action = resolveActionForMethod(method, access, statements);
    if (!action) {
      return [];
    }

    const checks: PermissionMethod<T>[] = [
      isPermitted(buildPermissionRequest(access.resource, action)) as PermissionMethod<T>,
    ];
    const also = access.also?.[method] ?? [];
    return [...checks, ...(also as PermissionMethod<T>[])];
  };

  return {
    create: buildMethodPermissions("create"),
    delete: buildMethodPermissions("delete"),
    list: buildMethodPermissions("list"),
    read: buildMethodPermissions("read"),
    update: buildMethodPermissions("update"),
  };
};

export const buildAccessQueryFilter = <T>(
  accessControl: AnyTerrenoAccess,
  access: ModelRouterAccessOptions,
  existing?: (
    user?: express.Request["user"],
    query?: Record<string, unknown>,
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>,
) => {
  return async (
    user?: express.Request["user"],
    query?: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> => {
    let merged: Record<string, unknown> | null = query ?? {};

    if (existing) {
      merged = await existing(user, query);
      if (merged === null) {
        return null;
      }
    }

    const statements = accessControl.statements as Record<string, readonly string[]>;
    const listAction = resolveActionForMethod("list", access, statements);
    if (!listAction) {
      return merged;
    }

    const scopeFilter = await accessControl.queryFilter({
      action: listAction,
      context: {query},
      resource: access.resource,
      user,
    });

    return mergeFilters(merged, scopeFilter);
  };
};

export const wrapAccessResponseHandler = <T>(
  accessControl: AnyTerrenoAccess,
  access: ModelRouterAccessOptions,
  baseHandler: (
    value: T | T[],
    method: RESTMethod,
    request: express.Request,
    options: {access?: ModelRouterAccessOptions},
  ) => Promise<unknown> | unknown,
) => {
  return async (
    value: T | T[],
    method: "list" | "create" | "read" | "update" | "delete",
    request: express.Request,
    options: {access?: ModelRouterAccessOptions},
  ): Promise<unknown> => {
    const serialized = await baseHandler(value, method, request, options);
    const phase = method === "create" ? "create" : "read";
    const docs = Array.isArray(serialized) ? serialized : [serialized];

    const masked = await Promise.all(
      docs.map(async (doc) => {
        const mask = await accessControl.fieldMask({
          doc,
          phase,
          resource: access.resource,
          user: request.user,
        });
        return applyReadMask(doc, mask);
      }),
    );

    return Array.isArray(serialized) ? masked : masked[0];
  };
};

export const validateAccessWriteBody = async ({
  accessControl,
  access,
  body,
  doc,
  phase,
  user,
}: {
  accessControl: AnyTerrenoAccess;
  access: ModelRouterAccessOptions;
  body: Record<string, unknown>;
  doc?: unknown;
  phase: "create" | "write";
  user?: express.Request["user"];
}): Promise<void> => {
  const mask = await accessControl.fieldMask({
    doc,
    phase: phase === "create" ? "create" : "write",
    resource: access.resource,
    user,
  });
  const disallowed = getDisallowedWriteKeys(body, mask);
  if (disallowed.length === 0) {
    return;
  }

  const fields: Record<string, string> = {};
  for (const key of disallowed) {
    fields[key] = "Field is not writable";
  }
  throw new APIError({
    fields,
    status: 400,
    title: "Validation failed",
  });
};

export const resolveModelRouterAccess = <T>(options: {
  access?: ModelRouterAccessOptions;
  accessControl?: AnyTerrenoAccess;
  permissions?: RESTPermissions<T>;
  queryFilter?: (
    user?: express.Request["user"],
    query?: Record<string, unknown>,
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  responseHandler?: (
    value: unknown,
    method: RESTMethod,
    request: express.Request,
    routerOptions: unknown,
  ) => Promise<unknown> | unknown;
  scope?: ResourceScope;
}): {
  permissions: RESTPermissions<T>;
  queryFilter?: (
    user?: express.Request["user"],
    query?: Record<string, unknown>,
  ) => Record<string, unknown> | null | Promise<Record<string, unknown> | null>;
  responseHandler?: (
    value: unknown,
    method: RESTMethod,
    request: express.Request,
    routerOptions: unknown,
  ) => Promise<unknown> | unknown;
} => {
  if (!options.access || !options.accessControl) {
    if (!options.permissions) {
      throw new Error("modelRouter requires permissions or access with accessControl");
    }
    return {
      permissions: options.permissions,
      queryFilter: options.queryFilter,
      responseHandler: options.responseHandler,
    };
  }

  const access: ModelRouterAccessOptions = {
    ...options.access,
    scope: options.access.scope ?? options.scope,
  };

  return {
    permissions: buildAccessPermissions(options.accessControl, access),
    queryFilter: buildAccessQueryFilter(
      options.accessControl,
      access,
      options.queryFilter,
    ) as typeof options.queryFilter,
    responseHandler: (options.responseHandler
      ? wrapAccessResponseHandler(
          options.accessControl,
          access,
          options.responseHandler as never,
        )
      : wrapAccessResponseHandler(
          options.accessControl,
          access,
          (value) => value,
        )) as typeof options.responseHandler,
  };
};
