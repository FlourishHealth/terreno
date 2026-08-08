import type {Schema} from "mongoose";

export interface RbacUser {
  roles: string[];
}

export interface RbacUserPluginOptions {
  /**
   * Role names assigned to newly created users. Apps that gate resources through
   * `access` need a baseline role here, otherwise signups start with no permissions.
   */
  defaultRoles?: string[];
}

export const rbacUserPlugin = (
  // noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
  // biome-ignore lint/suspicious/noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
  schema: Schema<any, any, any, any>,
  options?: RbacUserPluginOptions
): void => {
  const defaultRoles = [...(options?.defaultRoles ?? [])];
  schema.add({
    roles: {
      default: () => [...defaultRoles],
      description: "RBAC role names assigned to this user",
      index: true,
      type: [String],
    },
  });
};
