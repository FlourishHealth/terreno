import type {User} from "../auth";
import {APIError} from "../errors";
import {logger} from "../logger";
import {diffPermissionSets, isPermissionSubset, validatePermissionSet} from "./permissionUtils";
import {
  createRbacRoleModel,
  expandRolePermissions,
  type RbacRoleDocument,
  type RoleDefinition,
  terrenoDefaultRoles,
} from "./roleModel";
import type {PermissionSet, Statements} from "./statements";
import type {RoleInput, RoleManager} from "./types";

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

export const createRoleManager = (args: {
  connection: Parameters<typeof createRbacRoleModel>[0];
  statements: Statements;
  defaultRoles?: RoleDefinition[];
  getActorPermissions: (user: User) => Promise<PermissionSet>;
  invalidateCache: (invalidateArgs?: {userId?: string}) => void;
  userModel?: {findExactlyOne: (query: {id: string}) => Promise<User & {roles: string[]}>};
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
      const permissions = expandRolePermissions(role.permissions, statements);
      await rbacRoleModel.findOneAndUpdate(
        {name: role.name},
        {
          $set: {
            description: role.description,
            displayName: role.displayName,
            excludesRoles: role.excludesRoles ?? [],
            isLocked: role.isLocked ?? false,
            isSealed: role.isSealed ?? false,
            permissions,
          },
        },
        {upsert: true}
      );
    }
  };

  const roleManager: RoleManager = {
    assign: async ({actor, userId, roleNames}) => {
      await assertCanAssignRoles(actor, getActorPermissions);
      if (!userModel) {
        throw new APIError({status: 500, title: "User model not configured for role assignment"});
      }

      const targetUser = await userModel.findExactlyOne({id: userId});
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
        const permissions = role.permissions;
        await assertNoEscalation(actor, permissions, getActorPermissions);
      }

      targetUser.roles = uniqueRoleNames;
      await (targetUser as User & {save?: () => Promise<void>}).save?.();
      invalidateCache({userId});
    },
    create: async ({actor, role}) => {
      await assertCanManageRoles(actor, getActorPermissions);
      validatePermissionSet(role.permissions, statements);
      await assertNoEscalation(actor, role.permissions, getActorPermissions);

      const created = await rbacRoleModel.create({
        ...role,
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

      const targetUser = await userModel.findExactlyOne({id: userId});
      const before = await getActorPermissions(targetUser);
      const previewUser = {...targetUser, roles: [...new Set(roleNames)]};
      const after = await getActorPermissions(previewUser);
      const diff = diffPermissionSets(before, after);
      return {
        ...diff,
        resulting: after,
      };
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

      const targetUser = await userModel.findExactlyOne({id: userId});
      targetUser.roles = targetUser.roles.filter((role) => !roleNames.includes(role));
      await (targetUser as User & {save?: () => Promise<void>}).save?.();
      invalidateCache({userId});
    },
    update: async ({actor, roleName, changes}) => {
      await assertCanManageRoles(actor, getActorPermissions);
      const existing = await rbacRoleModel.findExactlyOne({name: roleName});
      if (existing.isSealed) {
        throw new APIError({status: 400, title: "Cannot modify a sealed role"});
      }
      if (changes.permissions) {
        validatePermissionSet(changes.permissions, statements);
        await assertNoEscalation(actor, changes.permissions, getActorPermissions);
      }
      if (changes.name && existing.isLocked) {
        throw new APIError({status: 400, title: "Cannot rename a locked role"});
      }

      Object.assign(existing, changes);
      await existing.save();
      invalidateCache();
      return existing;
    },
  };

  return {roleManager};
};

export type {RbacRoleDocument};
