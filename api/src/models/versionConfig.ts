import mongoose from "mongoose";

import {
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
  upsertPlugin,
} from "../plugins";

export interface VersionConfigDocument {
  webWarningVersion: number;
  webRequiredVersion: number;
  mobileWarningVersion: number;
  mobileRequiredVersion: number;
  warningMessage: string;
  requiredMessage: string;
  updateUrl?: string;
  created?: Date;
  updated?: Date;
  deleted?: boolean;
}

export type VersionConfigModel = mongoose.Model<VersionConfigDocument> & {
  findOneOrNone: (
    query: Record<string, unknown>,
    errorArgs?: {status?: number; title?: string}
  ) => Promise<mongoose.Document<VersionConfigDocument> | null>;
  findExactlyOne: (
    query: Record<string, unknown>,
    errorArgs?: {status?: number; title?: string}
  ) => Promise<mongoose.Document<VersionConfigDocument>>;
  upsert: (
    conditions: Record<string, unknown>,
    update: Record<string, unknown>
  ) => Promise<mongoose.Document<VersionConfigDocument>>;
};

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

versionConfigSchema.plugin(createdUpdatedPlugin);
versionConfigSchema.plugin(isDeletedPlugin);
versionConfigSchema.plugin(findOneOrNone);
versionConfigSchema.plugin(findExactlyOne);
versionConfigSchema.plugin(upsertPlugin);

export const VersionConfig = mongoose.model<VersionConfigDocument, VersionConfigModel>(
  "VersionConfig",
  versionConfigSchema
);
