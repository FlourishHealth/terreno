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
  /** OpenFeature default variant key; see schema description on {@link FeatureFlag}. */
  defaultVariant?: string;
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

/** Minimal Socket.io server shape for broadcasting flag change notifications. */
export interface FeatureFlagsSocketEmitter {
  emit(event: string, ...args: unknown[]): unknown;
}

export interface FeatureFlagsLiveUpdatesOptions {
  /**
   * Socket.io server (or a getter returning it once initialized). When null,
   * live updates are skipped.
   */
  socketIoServer: FeatureFlagsSocketEmitter | (() => FeatureFlagsSocketEmitter | null);
  /** Custom event name. Default: `featureFlagsChanged`. */
  eventName?: string;
}

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
  /** Optional Socket.io integration for live client refresh when flags change. */
  liveUpdates?: FeatureFlagsLiveUpdatesOptions;
  /**
   * OpenFeature provider domain for {@link OpenFeature.setProvider}. Defaults
   * to `"feature-flags"` so the global default provider is left untouched.
   */
  openFeatureDomain?: string;
}

export type EvaluationResult = Record<string, boolean | string | null>;

/** One flag entry in the `/flagConfiguration` response (OpenFeature static shape). */
export interface FlagDefinition {
  variants: Record<string, boolean | string>;
  disabled: boolean;
  defaultVariant: string;
}

export interface FlagConfigurationResponse {
  data: Record<string, FlagDefinition>;
}
