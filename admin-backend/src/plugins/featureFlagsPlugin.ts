import type {Schema} from "mongoose";
import mongoose from "mongoose";

export const featureFlagsPlugin = (schema: Schema) => {
  schema.add({
    featureFlags: {
      default: new Map(),
      description: "Per-user feature flag overrides (key → value)",
      of: mongoose.Schema.Types.Mixed,
      type: Map,
    },
  });
};
