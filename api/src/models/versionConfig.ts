import mongoose, {type Document} from "mongoose";

import {type APIErrorConstructor} from "../errors";
import {createdUpdatedPlugin, findOneOrNone} from "../plugins";

export interface VersionConfigDocument extends mongoose.Document {
  webWarningVersion: number;
  webRequiredVersion: number;
  mobileWarningVersion: number;
  mobileRequiredVersion: number;
  warningMessage: string;
  requiredMessage: string;
  updateUrl?: string;
  created?: Date;
  updated?: Date;
}

export interface VersionConfigModel extends mongoose.Model<VersionConfigDocument> {
  findOneOrNone(
    query: Record<string, any>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<(Document & VersionConfigDocument) | null>;
}

const versionConfigSchema = new mongoose.Schema<VersionConfigDocument>(
  {
    mobileRequiredVersion: {
      default: 0,
      description: "Build number at which mobile users are blocked from using the app",
      type: Number,
    },
    mobileWarningVersion: {
      default: 0,
      description: "Build number at which mobile users see a warning toast",
      type: Number,
    },
    requiredMessage: {
      default: "This version is no longer supported. Please update to continue.",
      description: "Message shown on the blocking screen",
      type: String,
    },
    updateUrl: {
      description:
        "App store or download URL for mobile updates (optional, falls back to expo-updates)",
      type: String,
    },
    warningMessage: {
      default: "A new version is available. Please update for the best experience.",
      description: "Message shown in the warning toast",
      type: String,
    },
    webRequiredVersion: {
      default: 0,
      description: "Build number at which web users are blocked from using the app",
      type: Number,
    },
    webWarningVersion: {
      default: 0,
      description: "Build number at which web users see a warning toast",
      type: Number,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

// Enforce singleton: only one VersionConfig document can exist.
// The _singleton field is always "config" (required, immutable, enum-constrained)
// and a unique index guarantees at most one document.
(versionConfigSchema as mongoose.Schema).add({
  _singleton: {
    default: "config",
    description: "Sentinel field to enforce singleton via unique index",
    enum: ["config"],
    immutable: true,
    required: true,
    select: false,
    type: String,
  },
});
versionConfigSchema.index({_singleton: 1}, {unique: true});

versionConfigSchema.plugin(createdUpdatedPlugin);
versionConfigSchema.plugin(findOneOrNone);

export const VersionConfig = mongoose.model<VersionConfigDocument, VersionConfigModel>(
  "VersionConfig",
  versionConfigSchema
);
