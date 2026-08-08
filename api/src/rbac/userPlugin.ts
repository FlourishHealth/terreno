import type {Schema} from "mongoose";

export interface RbacUser {
  roles: string[];
}

// noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
// biome-ignore lint/suspicious/noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
export const rbacUserPlugin = (schema: Schema<any, any, any, any>): void => {
  schema.add({
    roles: {
      default: [],
      description: "RBAC role names assigned to this user",
      index: true,
      type: [String],
    },
  });
};
