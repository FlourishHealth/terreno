import {
  APIError,
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
} from "@terreno/api";
import mongoose from "mongoose";
import type {FeatureFlagDocument, FeatureFlagModel} from "./types";

const featureFlagSchema = new mongoose.Schema<FeatureFlagDocument, FeatureFlagModel>(
  {
    archived: {
      default: false,
      description:
        "Archived flags are excluded from evaluation. Use this instead of deleting flags to prevent bloat as new features are added.",
      type: Boolean,
    },
    description: {
      default: "",
      description: "Explanation of what this flag controls",
      type: String,
    },
    enabled: {
      default: false,
      description: "Global kill switch — if false, flag is off for everyone",
      type: Boolean,
    },
    key: {
      description: "Unique identifier for the flag, e.g., 'new-checkout-flow'",
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    name: {
      description: "Human-readable display name",
      required: true,
      type: String,
    },
    rolloutPercentage: {
      default: 100,
      description: "For boolean flags with no matching rules: percentage of users who get true",
      max: 100,
      min: 0,
      type: Number,
    },
    rules: [
      {
        enabled: {
          description: "For boolean flags: override value when rule matches",
          type: Boolean,
        },
        field: {
          description:
            "User field to match against. Supports dot notation for nested fields, e.g., 'email', 'admin', 'address.zip'",
          type: String,
        },
        operator: {
          description: "Comparison operator for field-based rules",
          enum: ["eq", "neq", "in", "nin", "gt", "lt", "contains"],
          type: String,
        },
        segment: {
          description: "Name of a registered segment function, e.g., 'pro-users'",
          type: String,
        },
        value: {
          description: "Value to compare against (string, number, boolean, or array for in/nin)",
          type: mongoose.Schema.Types.Mixed,
        },
        variant: {
          description: "For variant flags: forced variant key when rule matches",
          type: String,
        },
      },
    ],
    type: {
      default: "boolean",
      description: "Boolean toggle or multi-variant A/B test",
      enum: ["boolean", "variant"],
      type: String,
    },
    variants: [
      {
        key: {
          description: "Variant identifier, e.g., 'control', 'variant-a'",
          required: true,
          type: String,
        },
        weight: {
          description: "Percentage weight for assignment (0-100, all must sum to 100)",
          max: 100,
          min: 0,
          required: true,
          type: Number,
        },
      },
    ],
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

featureFlagSchema.plugin(createdUpdatedPlugin);
featureFlagSchema.plugin(isDeletedPlugin);
featureFlagSchema.plugin(findExactlyOne);
featureFlagSchema.plugin(findOneOrNone);

featureFlagSchema.index({archived: 1, enabled: 1});

featureFlagSchema.pre("save", function () {
  if (this.type === "variant") {
    if (!this.variants || this.variants.length === 0) {
      throw new APIError({
        status: 400,
        title: "Variant flags must have at least one variant",
      });
    }
    const totalWeight = this.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new APIError({
        detail: `Total weight is ${totalWeight}, expected 100`,
        status: 400,
        title: "Variant weights must sum to 100",
      });
    }
  }
});

export const FeatureFlag = mongoose.model<FeatureFlagDocument, FeatureFlagModel>(
  "FeatureFlag",
  featureFlagSchema
);
