export const terrenoStatements = {
  admin: ["access", "runScripts", "viewBackgroundTasks"],
  configuration: ["read", "update"],
  rbac: ["read", "manageRoles", "assignRoles"],
  user: ["create", "list", "read", "update", "delete", "impersonate", "setPassword"],
} as const;

export type Statements = Record<string, readonly string[]>;

export type PermissionSet = {[resource: string]: readonly string[]};

export const READ_ACTIONS = ["read", "list", "access", "view"] as const;

export const READ_ONLY_ROLE_PERMISSIONS = {readOnly: true} as const;

export type RolePermissionSpec = PermissionSet | "*" | typeof READ_ONLY_ROLE_PERMISSIONS;

const isReadOnlySentinel = (spec: RolePermissionSpec): spec is typeof READ_ONLY_ROLE_PERMISSIONS =>
  typeof spec === "object" &&
  spec !== null &&
  !Array.isArray(spec) &&
  Object.keys(spec).length === 1 &&
  (spec as {readOnly?: unknown}).readOnly === true;

export const mergeStatements = <S extends Statements>(appStatements: S): Statements & S => {
  return {
    ...terrenoStatements,
    ...appStatements,
  };
};

export const expandRolePermissions = (
  spec: RolePermissionSpec,
  statements: Statements,
  readActions: readonly string[]
): PermissionSet => {
  if (spec === "*") {
    const expanded: PermissionSet = {};
    for (const [resource, actions] of Object.entries(statements)) {
      expanded[resource] = [...actions];
    }
    return expanded;
  }

  if (isReadOnlySentinel(spec)) {
    const expanded: PermissionSet = {};
    for (const [resource, actions] of Object.entries(statements)) {
      const readish = actions.filter((action) => readActions.includes(action));
      if (readish.length > 0) {
        expanded[resource] = readish;
      }
    }
    return expanded;
  }

  return spec;
};
