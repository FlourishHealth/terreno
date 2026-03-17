import mongoose from "mongoose";

import {createdUpdatedPlugin} from "../plugins";

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

export const VersionConfig = mongoose.model<VersionConfigDocument>(
  "VersionConfig",
  versionConfigSchema
);
