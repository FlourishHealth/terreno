import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

export interface FeatureFlagVariant {
  key: string;
  weight: number;
}

export interface FeatureFlagRule {
  field?: string;
  operator?: "eq" | "neq" | "in" | "nin" | "gt" | "lt" | "contains";
  value?: unknown;
  segment?: string;
  enabled?: boolean;
  variant?: string;
}

export type FeatureFlagType = "boolean" | "variant";

export type FeatureFlagDocument = mongoose.Document<mongoose.Types.ObjectId> & {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  type: FeatureFlagType;
  variants: FeatureFlagVariant[];
  rules: FeatureFlagRule[];
  rolloutPercentage: number;
  archived: boolean;
  created: Date;
  updated: Date;
  deleted: boolean;
};

export type FeatureFlagModel = mongoose.Model<FeatureFlagDocument> &
  FindExactlyOnePlugin<FeatureFlagDocument> &
  FindOneOrNonePlugin<FeatureFlagDocument>;

export type SegmentFunction = (user: unknown) => boolean;

export interface FeatureFlagsOptions {
  basePath?: string;
  segments?: Record<string, SegmentFunction>;
}

export type EvaluationResult = Record<string, boolean | string | null>;
