export type ConnectionQuality = "online" | "spotty" | "offline";

export type OfflineOperation =
  | "create"
  | "update"
  | "delete"
  | "arrayPush"
  | "arrayUpdate"
  | "arrayRemove";

export type QueuedMutationStatus = "queued" | "replaying" | "authBlocked" | "conflicted" | "failed";

export type ConflictResolution = "keepMine" | "useServer";

export interface HealthCheckSnapshot {
  checkedAt: string;
  latencyMs?: number;
  consecutiveFailures: number;
  recentFailureRate: number;
}

export interface QueuedMutation {
  id: string;
  endpointName: string;
  modelName: string;
  operation: OfflineOperation;
  args: unknown;
  body?: Record<string, unknown>;
  optimisticId?: string;
  serverId?: string;
  idempotencyKey: string;
  createdAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
  baseUpdatedAt?: string;
  status: QueuedMutationStatus;
  error?: string;
  /** Auth user ID when the mutation was queued */
  userId?: string;
  /** @deprecated Use createdAt */
  timestamp?: string;
  /** @deprecated Use operation */
  type?: OfflineOperation;
}

export interface ConflictRecord {
  id: string;
  queueId: string;
  endpointName: string;
  modelName: string;
  operation: "update" | "delete" | "arrayUpdate" | "arrayRemove";
  localArgs: unknown;
  localBody?: Record<string, unknown>;
  serverValue: unknown;
  baseUpdatedAt?: string;
  serverUpdatedAt?: string;
  dismissed: boolean;
  createdAt: string;
  /** @deprecated Use serverValue */
  serverDocument?: unknown;
  /** @deprecated Use localArgs */
  args?: unknown;
  /** @deprecated Use createdAt */
  timestamp?: string;
}

export interface OfflineOptimisticUpdateContext {
  mutation: QueuedMutation;
  tagType: string;
  listEndpointName: string;
}

export interface OfflineOptimisticUpdate {
  apply: (context: OfflineOptimisticUpdateContext) => void;
  rollback?: (context: OfflineOptimisticUpdateContext) => void;
}

export interface OfflineEndpointConfig {
  endpointName: string;
  enabled?: boolean;
  optimisticUpdate?: OfflineOptimisticUpdate;
}

export interface OfflineIdStrategy {
  generateId?: () => string;
  requestField?: string;
  reconcile?: "assumeClientId" | "mapServerId";
}

export interface OfflineModelConfig {
  modelName: string;
  tagType: string;
  endpoints: {
    create?: OfflineEndpointConfig;
    update?: OfflineEndpointConfig;
    delete?: OfflineEndpointConfig;
    arrayPush?: OfflineEndpointConfig;
    arrayUpdate?: OfflineEndpointConfig;
    arrayRemove?: OfflineEndpointConfig;
  };
  idStrategy?: OfflineIdStrategy;
  conflictStrategy?: "manual" | "keepMine" | "useServer";
}

export interface ConnectionQualityConfig {
  healthUrl?: string;
  pollIntervalMs?: number;
  offlinePollIntervalMs?: number;
  timeoutMs?: number;
  spottyLatencyMs?: number;
  offlineFailureCount?: number;
  spottyFailureRate?: number;
}

export interface OfflineAuthConfig {
  pauseReplayWhileRefreshing?: boolean;
  pauseReplayOnRefreshFailure?: boolean;
  clearCacheOnLogoutOnly?: boolean;
}

export interface OfflineModelRouterConfig {
  enabled: boolean;
  models: OfflineModelConfig[];
  connectionQuality?: ConnectionQualityConfig;
  auth?: OfflineAuthConfig;
}

/** Legacy endpoint-name list config; kept for apps already using it. */
export interface OfflineLegacyEndpointConfig {
  endpoints: string[];
}

export type OfflineMiddlewareOfflineConfig = OfflineModelRouterConfig | OfflineLegacyEndpointConfig;

export interface ResolvedOfflineEndpoint {
  endpointName: string;
  modelName: string;
  tagType: string;
  operation: OfflineOperation;
  idStrategy?: OfflineIdStrategy;
  conflictStrategy?: "manual" | "keepMine" | "useServer";
  optimisticUpdate?: OfflineOptimisticUpdate;
}
