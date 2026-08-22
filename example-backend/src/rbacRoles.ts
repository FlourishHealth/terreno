import type {RoleDefinition} from "@terreno/api";

/**
 * Baseline role every signed-up user receives. Terreno's shipped `member` role grants
 * nothing, so apps that gate resources through `access` define their own baseline.
 */
export const DEFAULT_USER_ROLE = "todoUser";

/** Role used by the seed scripts and admin UI demo for elevated todo access. */
export const MANAGER_ROLE = "manager";

/** Role granting the admin shell and RBAC management screens. */
export const SUPERADMIN_ROLE = "superadmin";

export const appDefaultRoles: RoleDefinition[] = [
  {
    description: "Baseline role for signed-up users: full CRUD on their own todos",
    displayName: "Todo User",
    name: DEFAULT_USER_ROLE,
    permissions: {
      todo: ["create", "read", "update", "delete", "list"],
    },
  },
  {
    description: "Can manage todos across the workspace but cannot delete them",
    displayName: "Manager",
    name: MANAGER_ROLE,
    permissions: {
      todo: ["create", "read", "update", "list"],
    },
  },
];
