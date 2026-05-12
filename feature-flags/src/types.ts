import type {FindExactlyOnePlugin, FindOneOrNonePlugin, ModelRouterOptions} from "@terreno/api";
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
  /**
   * Permission predicates that gate the admin CRUD routes for flags. When
   * omitted, defaults to requiring `Permissions.IsAdmin` (i.e. `user.admin === true`)
   * on every method. Provide this when consumers need role-based gating
   * other than the boolean `admin` flag.
   */
  permissions?: ModelRouterOptions<FeatureFlagDocument>["permissions"];
  /**
   * Predicate used to gate the `/segments` admin endpoint. Receives the
   * authenticated user and should return true to allow the request. Defaults
   * to checking `user.admin === true` when not provided.
   */
  segmentsPermission?: (user: unknown) => boolean;
}

export type EvaluationResult = Record<string, boolean | string | null>;
