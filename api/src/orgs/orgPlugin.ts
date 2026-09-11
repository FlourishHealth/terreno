import mongoose, {type Schema} from "mongoose";

export interface OrgScoped {
  organizationId: mongoose.Types.ObjectId;
}

/**
 * Adds a required indexed `organizationId` so tenant-scoped consumer models cannot be saved
 * without an organization.
 */
export const orgScopedPlugin = (schema: Schema): void => {
  schema.add({
    organizationId: {
      description: "Organization this document belongs to",
      index: true,
      ref: "Organization",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  });
};
