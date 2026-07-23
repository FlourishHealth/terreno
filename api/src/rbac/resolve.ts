import {createAccessControl} from "better-auth/plugins/access";

import type {User} from "../auth";
import {logger} from "../logger";
import {unionPermissionSets} from "./permissionUtils";
import {createRbacRoleModel, type RbacRoleModel} from "./roleModel";
import type {PermissionSet, Statements} from "./statements";
import type {PermissionSource, PermissionSourceGrants} from "./types";

interface CacheEntry {
  permissions: PermissionSet;
  expiresAt: number;
}

interface SourceCacheEntry {
  grants: PermissionSourceGrants | null;
  fetchedAt: number;
}

const DEFAULT_CACHE_TTL_MS = 30_000;

const getUserRoles = (user: User): string[] => {
  const withRoles = user as User & {roles?: string[]};
  return withRoles.roles ?? [];
};

export const createPermissionResolver = <S extends Statements>(args: {
  statements: S;
  rbacRoleModel: RbacRoleModel;
  sources?: PermissionSource[];
  cacheTtlMs?: number;
  resolvePermissions?: (args: {user: User}) => Promise<PermissionSet | null>;
}) => {
  const {
    statements,
    rbacRoleModel,
    sources = [],
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    resolvePermissions,
  } = args;

  const ac = createAccessControl(statements);
  const permissionCache = new Map<string, CacheEntry>();
  const sourceCache = new Map<string, Map<string, SourceCacheEntry>>();

  const invalidateCache = (invalidateArgs?: {userId?: string}): void => {
    if (invalidateArgs?.userId) {
      permissionCache.delete(invalidateArgs.userId);
      sourceCache.delete(invalidateArgs.userId);
      return;
    }
    permissionCache.clear();
    sourceCache.clear();
  };

  const loadRolePermissions = async (roleNames: string[]): Promise<PermissionSet[]> => {
    if (roleNames.length === 0) {
      return [];
    }

    const roleDocs = await rbacRoleModel.find({name: {$in: roleNames}});
    return roleDocs.map((roleDoc) => roleDoc.permissions);
  };

  const applyDenyGrants = (permissions: PermissionSet, deny?: PermissionSet): PermissionSet => {
    if (!deny) {
      return permissions;
    }

    const result: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(permissions)) {
      const denied = new Set(deny[resource] ?? []);
      const remaining = actions.filter((action) => !denied.has(action));
      if (remaining.length > 0) {
        result[resource] = remaining;
      }
    }
    return result;
  };

  const fetchSourceGrants = async (
    user: User,
    source: PermissionSource
  ): Promise<PermissionSourceGrants | null> => {
    const userSources = sourceCache.get(user.id) ?? new Map<string, SourceCacheEntry>();
    sourceCache.set(user.id, userSources);

    const cached = userSources.get(source.name);
    const ttlMs = source.ttlMs ?? cacheTtlMs;
    const now = Date.now();

    if (cached && now - cached.fetchedAt < ttlMs) {
      return cached.grants;
    }

    try {
      const grants = await source.getGrants({user});
      userSources.set(source.name, {fetchedAt: now, grants});
      return grants;
    } catch (error) {
      logger.warn("Permission source refresh failed", {
        error: error instanceof Error ? error.message : String(error),
        policy: source.staleOnFailure ?? "deny",
        source: source.name,
      });

      if (
        source.staleOnFailure === "use-stale-bounded" &&
        cached &&
        source.staleMaxAgeMs &&
        now - cached.fetchedAt < source.staleMaxAgeMs
      ) {
        return cached.grants;
      }

      if (source.staleOnFailure === "use-stale" && cached) {
        return cached.grants;
      }

      return null;
    }
  };

  const resolvePermissionsForUser = async (user: User): Promise<PermissionSet> => {
    const cached = permissionCache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const roleNames = [...getUserRoles(user)];
    const permissionSets: PermissionSet[] = [];

    for (const source of sources) {
      const grants = await fetchSourceGrants(user, source);
      if (!grants) {
        continue;
      }
      if (grants.roles?.length) {
        roleNames.push(...grants.roles);
      }
      if (grants.permissions) {
        permissionSets.push(grants.permissions);
      }
    }

    const uniqueRoleNames = [...new Set(roleNames)];
    permissionSets.push(...(await loadRolePermissions(uniqueRoleNames)));

    if (resolvePermissions) {
      const custom = await resolvePermissions({user});
      if (custom) {
        permissionSets.push(custom);
      }
    }

    let permissions = unionPermissionSets(...permissionSets);

    for (const source of sources) {
      const grants = await fetchSourceGrants(user, source);
      if (grants?.deny) {
        permissions = applyDenyGrants(permissions, grants.deny);
      }
    }

    permissionCache.set(user.id, {
      expiresAt: Date.now() + cacheTtlMs,
      permissions,
    });

    return permissions;
  };

  const authorizePermissions = (
    permissions: PermissionSet,
    request: PermissionSet
  ): {success: boolean; error?: string} => {
    const role = ac.newRole(permissions as never);
    return role.authorize(request as never);
  };

  return {
    ac,
    authorizePermissions,
    invalidateCache,
    resolvePermissionsForUser,
  };
};
