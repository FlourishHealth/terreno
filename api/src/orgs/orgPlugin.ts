import mongoose, {type Schema} from "mongoose";

import {BadRequestError} from "../errors";

export interface OrgScoped {
  organizationId: mongoose.Types.ObjectId;
}

export const ORGANIZATION_ID_IMMUTABLE_TITLE = "organizationId cannot be changed";

const organizationIdsMatch = (
  left: mongoose.Types.ObjectId | string | undefined,
  right: mongoose.Types.ObjectId | string | undefined
): boolean => {
  if (left === undefined || right === undefined) {
    return true;
  }
  return String(left) === String(right);
};

/** Rejects post-create changes to an existing `organizationId` schema path. */
export const organizationIdImmutabilityPlugin = (schema: Schema): void => {
  schema.pre("save", function () {
    if (this.isNew || !this.isModified("organizationId")) {
      return;
    }
    throw new BadRequestError(ORGANIZATION_ID_IMMUTABLE_TITLE);
  });

  schema.pre(["updateOne", "findOneAndUpdate"], async function () {
    const update = this.getUpdate() as Record<string, unknown> | null;
    if (!update || typeof update !== "object") {
      return;
    }
    const setPayload = (update.$set ?? update) as Record<string, unknown>;
    if (!Object.hasOwn(setPayload, "organizationId")) {
      return;
    }
    const existing = await this.model
      .findOne(this.getFilter())
      .select("organizationId")
      .lean<{organizationId?: mongoose.Types.ObjectId | string}>();
    if (existing?.organizationId === undefined) {
      return;
    }
    if (
      !organizationIdsMatch(
        existing.organizationId,
        setPayload.organizationId as mongoose.Types.ObjectId | string
      )
    ) {
      throw new BadRequestError(ORGANIZATION_ID_IMMUTABLE_TITLE);
    }
  });
};

/**
 * Adds a required indexed `organizationId` so tenant-scoped consumer models cannot be saved
 * without an organization. After creation, `organizationId` is immutable for REST, admin,
 * sync, and direct saves.
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
  organizationIdImmutabilityPlugin(schema);
};
