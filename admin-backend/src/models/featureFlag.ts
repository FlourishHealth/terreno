import {createdUpdatedPlugin} from "@terreno/api";
import mongoose, {type Document} from "mongoose";

export interface FeatureFlagDocument extends Document {
  key: string;
  description: string;
  flagType: "boolean" | "string";
  defaultValue: any;
  enabled: boolean;
  globalValue?: any;
  status: "active" | "archived";
  created: Date;
  updated: Date;
}

const featureFlagSchema = new mongoose.Schema<FeatureFlagDocument>(
  {
    defaultValue: {
      description: "Default value when the flag is enabled but no override is set",
      required: true,
      type: mongoose.Schema.Types.Mixed,
    },
    description: {
      default: "",
      description: "Human-readable description of what this flag controls",
      type: String,
    },
    enabled: {
      default: false,
      description: "Global kill switch — when false, flag always returns code-provided default",
      type: Boolean,
    },
    flagType: {
      description: "The value type of this flag",
      enum: ["boolean", "string"],
      required: true,
      type: String,
    },
    globalValue: {
      description: "Optional global override value when flag is enabled",
      type: mongoose.Schema.Types.Mixed,
    },
    key: {
      description: "Unique flag identifier used in code (e.g., 'new-checkout-flow')",
      index: true,
      required: true,
      type: String,
      unique: true,
    },
    status: {
      default: "active",
      description:
        "Active flags are registered in code; archived flags have been removed from code",
      enum: ["active", "archived"],
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

featureFlagSchema.plugin(createdUpdatedPlugin);

export const FeatureFlag = mongoose.model<FeatureFlagDocument>("FeatureFlag", featureFlagSchema);
