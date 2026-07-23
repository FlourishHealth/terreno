import type {Document} from "mongoose";
import mongoose, {type Connection, type Model} from "mongoose";
import type {APIErrorConstructor} from "../errors";
import {createdUpdatedPlugin, findExactlyOne, findOneOrNone} from "../plugins";
import {
  expandRolePermissions as expandRolePermissionSpec,
  type PermissionSet,
  READ_ACTIONS,
  READ_ONLY_ROLE_PERMISSIONS,
  type RolePermissionSpec,
  type Statements,
} from "./statements";

export interface RoleDefinition {
  name: string;
  displayName: string;
  description?: string;
  permissions: RolePermissionSpec;
  excludesRoles?: string[];
  isLocked?: boolean;
  isSealed?: boolean;
}

export interface RbacRoleDocument {
  _id: mongoose.Types.ObjectId;
  name: string;
  displayName: string;
  description?: string;
  permissions: PermissionSet;
  excludesRoles: string[];
  isLocked: boolean;
  isSealed: boolean;
  created: Date;
  updated: Date;
}

export type RbacRoleModel = Model<RbacRoleDocument> & {
  findExactlyOne: (
    query: Record<string, unknown>,
    errorArgs?: Partial<APIErrorConstructor>
  ) => Promise<Document & RbacRoleDocument>;
  findOneOrNone: (
    query: Record<string, unknown>,
    errorArgs?: Partial<APIErrorConstructor>
  ) => Promise<(Document & RbacRoleDocument) | null>;
  seedDefaults: (args: {statements: Statements}) => Promise<void>;
};

export {READ_ONLY_ROLE_PERMISSIONS} from "./statements";

export const expandRolePermissions = (
  spec: RolePermissionSpec,
  statements: Statements,
  readActions: readonly string[] = READ_ACTIONS
): PermissionSet => expandRolePermissionSpec(spec, statements, readActions);

export const terrenoDefaultRoles: RoleDefinition[] = [
  {
    displayName: "Super Admin",
    isLocked: true,
    isSealed: true,
    name: "superadmin",
    permissions: "*",
  },
  {
    displayName: "Admin",
    isLocked: true,
    name: "admin",
    permissions: {
      admin: ["access"],
      configuration: ["read", "update"],
      user: ["create", "list", "read", "update"],
    },
  },
  {
    displayName: "Auditor",
    isLocked: true,
    name: "auditor",
    permissions: READ_ONLY_ROLE_PERMISSIONS,
  },
  {
    displayName: "Member",
    isLocked: true,
    name: "member",
    permissions: {},
  },
];

const rbacRoleSchema = new mongoose.Schema<RbacRoleDocument, RbacRoleModel>(
  {
    description: {
      description: "Human-readable description of the role",
      type: String,
    },
    displayName: {
      description: "Human-readable name shown in the admin UI",
      required: true,
      trim: true,
      type: String,
    },
    excludesRoles: {
      default: [],
      description: "Role names that cannot be held together with this role",
      type: [String],
    },
    isLocked: {
      default: false,
      description: "Whether the role name is locked from deletion or renaming",
      type: Boolean,
    },
    isSealed: {
      default: false,
      description: "Whether the role is immutable through the admin API",
      type: Boolean,
    },
    name: {
      description: "Stable machine name stored on users",
      index: true,
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    permissions: {
      description: "Permission JSON validated against access statements",
      required: true,
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

rbacRoleSchema.plugin(createdUpdatedPlugin);
rbacRoleSchema.plugin(findOneOrNone);
rbacRoleSchema.plugin(findExactlyOne);

rbacRoleSchema.statics = {
  ...rbacRoleSchema.statics,
  async seedDefaults(this: RbacRoleModel, {statements}: {statements: Statements}): Promise<void> {
    for (const role of terrenoDefaultRoles) {
      const permissions = expandRolePermissions(role.permissions, statements);
      await this.findOneAndUpdate(
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
  },
};

export const createRbacRoleModel = (connection: Connection): RbacRoleModel => {
  if (connection.models.RbacRole) {
    return connection.models.RbacRole as RbacRoleModel;
  }
  return connection.model<RbacRoleDocument, RbacRoleModel>("RbacRole", rbacRoleSchema);
};

export const RbacRoleModel = createRbacRoleModel(mongoose.connection);
