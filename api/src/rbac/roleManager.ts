import type {User, UserModel} from "../auth";
import {APIError} from "../errors";
import {logger} from "../logger";
import {diffPermissionSets, isPermissionSubset, validatePermissionSet} from "./permissionUtils";
import {
  createRbacRoleModel,
  type RbacRoleDocument,
  type RoleDefinition,
  terrenoDefaultRoles,
  upsertSeededRole,
} from "./roleModel";
import type {PermissionSet, Statements} from "./statements";
import type {RoleManager} from "./types";

const assertCanManageRoles = async (
  actor: User,
  getActorPermissions: (user: User) => Promise<PermissionSet>
): Promise<void> => {
  const actorPermissions = await getActorPermissions(actor);
  if (!actorPermissions.rbac?.includes("manageRoles")) {
    throw new APIError({status: 403, title: "Missing rbac:manageRoles permission"});
  }
};

const assertCanAssignRoles = async (
  actor: User,
  getActorPermissions: (user: User) => Promise<PermissionSet>
): Promise<void> => {
  const actorPermissions = await getActorPermissions(actor);
  if (!actorPermissions.rbac?.includes("assignRoles")) {
    throw new APIError({status: 403, title: "Missing rbac:assignRoles permission"});
  }
};

const assertValidPermissionSet = (
  permissions: PermissionSet,
  statements: Parameters<typeof validatePermissionSet>[1]
): void => {
  try {
    validatePermissionSet(permissions, statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid permissions";
    throw new APIError({detail: message, status: 400, title: "Invalid permissions"});
  }
};

const assertUserSaveAvailable = (targetUser: {save?: unknown}): void => {
  if (typeof targetUser.save !== "function") {
    throw new APIError({
      status: 500,
      title: "User model does not support saving role assignments",
    });
  }
};

const assertNoEscalation = async (
  actor: User,
  permissions: PermissionSet,
  getActorPermissions: (user: User) => Promise<PermissionSet>
): Promise<void> => {
  const actorPermissions = await getActorPermissions(actor);
  if (!isPermissionSubset(actorPermissions, permissions)) {
    logger.warn("RBAC escalation attempt denied", {
      actorId: actor.id,
      requestedPermissions: permissions,
    });
    throw new APIError({
      status: 403,
      title: "Cannot grant permissions you do not hold",
    });
  }
};

const assertCanModifyTargetUser = async (
  actor: User,
  target: User,
  getActorPermissions: (user: User) => Promise<PermissionSet>
): Promise<void> => {
  const actorPermissions = await getActorPermissions(actor);
  const targetPermissions = await getActorPermissions(target);
  if (!isPermissionSubset(actorPermissions, targetPermissions)) {
    logger.warn("RBAC privileged-user mutation denied", {
      actorId: actor.id,
      targetId: target.id,
    });
    throw new APIError({
      status: 403,
      title: "Cannot modify a user with permissions you do not hold",
    });
  }
};

export const createRoleManager = (args: {
  connection: Parameters<typeof createRbacRoleModel>[0];
  statements: Statements;
  defaultRoles?: RoleDefinition[];
  getActorPermissions: (user: User) => Promise<PermissionSet>;
  invalidateCache: (invalidateArgs?: {userId?: string}) => void;
  userModel?: UserModel;
}): {roleManager: RoleManager} => {
  const {
    connection,
    statements,
    defaultRoles = terrenoDefaultRoles,
    getActorPermissions,
    invalidateCache,
    userModel,
  } = args;

  const rbacRoleModel = createRbacRoleModel(connection);

  const seedDefaults = async (): Promise<void> => {
    await rbacRoleModel.seedDefaults({statements});
    for (const role of defaultRoles ?? []) {
      if (terrenoDefaultRoles.some((defaultRole) => defaultRole.name === role.name)) {
        continue;
      }
      await upsertSeededRole(rbacRoleModel, role, statements);
    }
  };

  const roleManager: RoleManager = {
    assertCanModifyUser: async ({actor, userId}) => {
      if (!userModel) {
        throw new APIError({status: 500, title: "User model not configured for role assignment"});
      }
      const targetUser = await userModel.findById(userId);
      if (!targetUser) {
        throw new APIError({status: 404, title: "User not found"});
      }
      await assertCanModifyTargetUser(actor, targetUser, getActorPermissions);
    },
    assign: async ({actor, userId, roleNames}) => {
      await assertCanAssignRoles(actor, getActorPermissions);
      if (!userModel) {
        throw new APIError({status: 500, title: "User model not configured for role assignment"});
      }

      const targetUser = await userModel.findById(userId);
      if (!targetUser) {
        throw new APIError({status: 404, title: "User not found"});
      }
      await assertCanModifyTargetUser(actor, targetUser, getActorPermissions);
      const uniqueRoleNames = [...new Set(roleNames)];
      for (let i = 0; i < uniqueRoleNames.length; i++) {
        for (let j = i + 1; j < uniqueRoleNames.length; j++) {
          const roleA = await rbacRoleModel.findExactlyOne({name: uniqueRoleNames[i]});
          const roleB = await rbacRoleModel.findExactlyOne({name: uniqueRoleNames[j]});
          if (
            roleA.excludesRoles.includes(roleB.name) ||
            roleB.excludesRoles.includes(roleA.name)
          ) {
            throw new APIError({
              status: 409,
              title: `Role ${roleA.name} conflicts with ${roleB.name}`,
            });
          }
        }
      }

      for (const roleName of uniqueRoleNames) {
        const role = await rbacRoleModel.findExactlyOne({name: roleName});
        const permissions = role.permissions ?? {};
        await assertNoEscalation(actor, permissions, getActorPermissions);
      }

      assertUserSaveAvailable(targetUser);
      const rbacUser = targetUser as unknown as User & {roles: string[]};
      rbacUser.roles = uniqueRoleNames;
      await targetUser.save();
      invalidateCache({userId});
    },
    create: async ({actor, role}) => {
      await assertCanManageRoles(actor, getActorPermissions);
      assertValidPermissionSet(role.permissions, statements);
      await assertNoEscalation(actor, role.permissions, getActorPermissions);

      const created = await rbacRoleModel.create({
        ...role,
        description: role.description ?? undefined,
        excludesRoles: role.excludesRoles ?? [],
        isLocked: role.isLocked ?? false,
        isSealed: role.isSealed ?? false,
      });
      return created;
    },
    list: async () => rbacRoleModel.find({}).sort({name: 1}),
    previewAssignment: async ({userId, roleNames}) => {
      if (!userModel) {
        throw new APIError({status: 500, title: "User model not configured for role assignment"});
      }

      const targetUser = await userModel.findById(userId);
      if (!targetUser) {
        throw new APIError({status: 404, title: "User not found"});
      }
      const before = await getActorPermissions(targetUser);
      const previewUser = {
        ...(typeof (targetUser as {toObject?: () => Record<string, unknown>}).toObject ===
        "function"
          ? (targetUser as {toObject: () => Record<string, unknown>}).toObject()
          : targetUser),
        id: targetUser.id,
        roles: [...new Set(roleNames)],
      } as unknown as User;
      invalidateCache({userId});
      try {
        const after = await getActorPermissions(previewUser);
        const diff = diffPermissionSets(before, after);
        return {
          ...diff,
          resulting: after,
        };
      } finally {
        invalidateCache({userId});
      }
    },
    previewRoleChange: async ({roleName, permissions}) => {
      const existing = await rbacRoleModel.findExactlyOne({name: roleName});
      const diff = diffPermissionSets(existing.permissions, permissions);
      return {
        ...diff,
        affectedUserCount: 0,
      };
    },
    remove: async ({actor, roleName}) => {
      await assertCanManageRoles(actor, getActorPermissions);
      const existing = await rbacRoleModel.findExactlyOne({name: roleName});
      if (existing.isLocked) {
        throw new APIError({status: 400, title: "Cannot delete a locked role"});
      }
      await existing.deleteOne();
      invalidateCache();
    },
    seedDefaults,
    unassign: async ({actor, userId, roleNames}) => {
      await assertCanAssignRoles(actor, getActorPermissions);
      if (!userModel) {
        throw new APIError({status: 500, title: "User model not configured for role assignment"});
      }

      const targetUser = await userModel.findById(userId);
      if (!targetUser) {
        throw new APIError({status: 404, title: "User not found"});
      }
      await assertCanModifyTargetUser(actor, targetUser, getActorPermissions);
      assertUserSaveAvailable(targetUser);
      const rbacUser = targetUser as unknown as User & {roles: string[]};
      rbacUser.roles = rbacUser.roles.filter((role) => !roleNames.includes(role));
      await targetUser.save();
      invalidateCache({userId});
    },
    update: async ({actor, roleName, changes}) => {
      await assertCanManageRoles(actor, getActorPermissions);
      const existing = await rbacRoleModel.findExactlyOne({name: roleName});
      if (existing.isSealed) {
        throw new APIError({status: 400, title: "Cannot modify a sealed role"});
      }
      if (existing.isLocked) {
        const forbidden = Object.keys(changes).filter(
          (key) =>
            !["description", "displayName", "permissions", "excludesRoles", "name"].includes(key)
        );
        if (forbidden.length > 0) {
          throw new APIError({
            status: 400,
            title: "Cannot change locked fields on a locked role",
          });
        }
      }
      if (changes.permissions) {
        assertValidPermissionSet(changes.permissions, statements);
        await assertNoEscalation(actor, changes.permissions, getActorPermissions);
      }
      if (changes.name && existing.isLocked) {
        throw new APIError({status: 400, title: "Cannot rename a locked role"});
      }
      if (changes.excludesRoles && userModel) {
        const holders = await userModel.find({roles: roleName});
        const excluded = new Set(changes.excludesRoles);
        const conflicts = holders.filter((holder) => {
          const holderRoles = ((holder as unknown as {roles?: string[]}).roles ?? []).filter(
            (role) => role !== roleName
          );
          return holderRoles.some((role) => excluded.has(role));
        });
        if (conflicts.length > 0) {
          throw new APIError({
            status: 400,
            title: "excludesRoles conflicts with existing assignments",
          });
        }
      }

      const allowedChanges: Record<string, unknown> = {};
      for (const key of ["description", "displayName", "permissions", "excludesRoles", "name"]) {
        if (key in changes) {
          const value = (changes as Record<string, unknown>)[key];
          allowedChanges[key] = value === null ? undefined : value;
        }
      }
      Object.assign(existing, allowedChanges);
      if (changes.description === null) {
        existing.set("description", undefined);
      }
      await existing.save();
      invalidateCache();
      return existing;
    },
  };

  return {roleManager};
};

export type {RbacRoleDocument};
