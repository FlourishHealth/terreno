import type express from "express";

import type {User} from "../auth";

import {createIsPermitted, createRequireAccess} from "./middleware";
import {createPermissionResolver} from "./resolve";
import {createRoleManager} from "./roleManager";
import {createRbacRoleModel} from "./roleModel";
import {mergeStatements, type Statements} from "./statements";
import type {
  AccessCheckArgs,
  AccessOptions,
  AccessResult,
  FieldMask,
  PermissionRequest,
  TerrenoAccess,
} from "./types";

const FULL_FIELD_MASK: FieldMask = {
  omit: [],
  read: "*",
  write: "*",
};

export const createAccess = <S extends Statements>(options: AccessOptions<S>): TerrenoAccess<S> => {
  const mergedStatements = mergeStatements(options.statements) as S;
  const rbacRoleModel = createRbacRoleModel(options.connection);

  const resolver = createPermissionResolver({
    cacheTtlMs: options.cacheTtlMs,
    rbacRoleModel,
    resolvePermissions: options.resolvePermissions,
    sources: options.sources,
    statements: mergedStatements,
  });

  const {roleManager} = createRoleManager({
    connection: options.connection,
    defaultRoles: options.defaultRoles,
    getActorPermissions: (user) => resolver.resolvePermissionsForUser(user),
    invalidateCache: resolver.invalidateCache,
    statements: mergedStatements,
  });

  const can = async (args: AccessCheckArgs<S>): Promise<AccessResult> => {
    if (!args.user) {
      return {allowed: false, deniedBy: "role", reason: "Unauthenticated"};
    }

    const effectivePermissions = await resolver.resolvePermissionsForUser(args.user);
    const roleResult = resolver.authorizePermissions(
      effectivePermissions,
      args.permissions as never
    );

    if (!roleResult.success) {
      return {
        allowed: false,
        deniedBy: "role",
        reason: roleResult.error,
      };
    }

    if (args.doc && options.scopes) {
      for (const [resource, actions] of Object.entries(args.permissions)) {
        for (const action of actions ?? []) {
          const scopeKey = `${resource}.${action}`;
          const wildcardScope = options.scopes[`${resource}.*`];
          const scope = options.scopes[scopeKey] ?? wildcardScope;
          if (!scope?.check) {
            continue;
          }

          const checkResult = await scope.check({
            action,
            context: args.context,
            doc: args.doc,
            user: args.user,
          });

          if (checkResult === false) {
            return {allowed: false, deniedBy: "scope", reason: `Denied by ${scopeKey}`};
          }

          if (checkResult && typeof checkResult === "object") {
            const extraResult = resolver.authorizePermissions(
              effectivePermissions,
              checkResult as never
            );
            if (!extraResult.success) {
              return {
                allowed: false,
                deniedBy: "scope",
                reason: extraResult.error,
              };
            }
          }
        }
      }
    }

    return {allowed: true};
  };

  const queryFilter = async (args: {
    user?: User;
    resource: keyof S & string;
    action: string;
    context?: Record<string, unknown>;
  }): Promise<Record<string, unknown> | null> => {
    if (!args.user) {
      return null;
    }

    const roleResult = await can({
      context: args.context,
      permissions: {[args.resource]: [args.action]} as PermissionRequest<S>,
      user: args.user,
    });
    if (!roleResult.allowed) {
      return null;
    }

    const scopeKey = `${args.resource}.${args.action}`;
    const scope = options.scopes?.[scopeKey] ?? options.scopes?.[`${args.resource}.*`];
    if (!scope?.filter) {
      return {};
    }

    return scope.filter({
      action: args.action,
      context: args.context,
      user: args.user,
    });
  };

  const fieldMask = async (args: {
    user?: User;
    resource: keyof S & string;
    doc?: unknown;
    phase?: "read" | "write" | "create";
  }): Promise<FieldMask> => {
    const fieldView = options.fieldViews?.[args.resource];
    if (!fieldView || !args.user) {
      return FULL_FIELD_MASK;
    }

    const permissions = await resolver.resolvePermissionsForUser(args.user);
    const phase = args.phase ?? "read";
    const selected = await fieldView.select({
      doc: args.doc,
      permissions,
      phase,
      user: args.user,
    });

    if (typeof selected === "string") {
      return fieldView.views[selected] ?? FULL_FIELD_MASK;
    }

    return selected;
  };

  return {
    ac: resolver.ac,
    can,
    fieldMask,
    getPermissions: ({user}) => resolver.resolvePermissionsForUser(user),
    invalidateCache: resolver.invalidateCache,
    middleware: createRequireAccess({can}),
    permission: createIsPermitted({can}),
    queryFilter,
    roles: roleManager,
    statements: mergedStatements,
  };
};
