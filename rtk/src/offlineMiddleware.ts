import {createListenerMiddleware, type Middleware} from "@reduxjs/toolkit";
import type {Api} from "@reduxjs/toolkit/query/react";
import {DateTime} from "luxon";

import {getAuthToken, selectCurrentUserId} from "./authSlice";
import {baseUrl, LOGOUT_ACTION_TYPE, type RootState, TOKEN_REFRESHED_SUCCESS} from "./constants";
import {isModelRouterOfflineConfig} from "./offlineConfig";
import {configureOfflineMiddleware, getConfiguredOfflineEndpoint} from "./offlineGate";
import {resolveOfflineIdStrategy} from "./offlineIds";
import {
  applyOptimisticUpdate,
  getCachedQueryArgs,
  inferGetByIdEndpointName,
  inferListEndpointName,
  patchCacheWithServerDocument,
  removeOptimisticTempItems,
} from "./offlineOptimistic";
import {
  addConflict,
  type ConflictRecord,
  clearConflicts,
  clearQueue,
  dequeue,
  enqueue,
  markMutationAuthBlocked,
  markMutationStatus,
  type OfflineState,
  offlineReducer,
  offlineSlice,
  type QueuedMutation,
  resolveConflictKeepMine,
  resolveConflictUseServer,
  resumeReplayAfterAuth,
  selectConnectionQuality,
  selectIsReplayPausedForAuth,
  selectIsSyncing,
  selectOfflineQueue,
  setConnectionQuality,
  setOnlineStatus,
  setSyncing,
} from "./offlineSlice";
import type {
  ConflictResolution,
  OfflineMiddlewareOfflineConfig,
  OfflineModelRouterConfig,
  ResolvedOfflineEndpoint,
} from "./offlineTypes";
import {IsWeb} from "./platform";

export interface OfflineMiddlewareConfig {
  /** RTK Query API instance */
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>;
  /** ModelRouter offline config (preferred) */
  offline?: OfflineMiddlewareOfflineConfig;
  /** @deprecated Use offline.models or offline.endpoints */
  endpoints?: string[];
}

/**
 * True when a rejected RTK Query action failed due to a network/transport error,
 * not an auth or application-level FETCH_ERROR from emptyApi.
 */
export const isNetworkFetchError = (
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query error shapes vary by source
  source: any
): boolean => {
  if (source?.error?.name === "TypeError") {
    return true;
  }

  const NETWORK_PATTERNS = [
    "failed to fetch",
    "fetch failed",
    "network error",
    "network unavailable",
    "load failed",
  ];

  const candidates: string[] = [];
  if (typeof source?.error?.message === "string") {
    candidates.push(source.error.message);
  }
  if (typeof source?.error === "string") {
    candidates.push(source.error);
  }
  if (typeof source?.payload?.error === "string") {
    candidates.push(source.payload.error);
  }
  if (typeof source?.status === "string" && source.status === "FETCH_ERROR") {
    if (typeof source?.error === "string") {
      candidates.push(source.error);
    }
  }

  const combined = candidates.join(" ").toLowerCase();
  return NETWORK_PATTERNS.some((p) => combined.includes(p));
};

export const shouldReplayQueuedMutation = (
  mutation: QueuedMutation,
  currentUserId: string | undefined
): boolean => {
  if (!currentUserId) {
    return false;
  }
  if (mutation.userId === undefined) {
    return false;
  }
  return mutation.userId === currentUserId;
};

export {buildOptimisticCreateItem} from "./offlineOptimistic";

const resolveOfflineConfig = (config: OfflineMiddlewareConfig): OfflineMiddlewareOfflineConfig => {
  if (config.offline) {
    return config.offline;
  }
  if (config.endpoints) {
    return {endpoints: config.endpoints};
  }
  return {enabled: false, models: []};
};

const extractBaseUpdatedAt = (
  endpoint: ResolvedOfflineEndpoint,
  originalArgs: unknown,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>
): string | undefined => {
  if (endpoint.operation !== "update" && endpoint.operation !== "arrayUpdate") {
    return undefined;
  }

  const args = originalArgs as {body?: Record<string, unknown>; id?: string};
  const bodyUpdatedAt = args?.body?._updatedAt;
  if (typeof bodyUpdatedAt === "string") {
    return bodyUpdatedAt;
  }

  if (!args?.id) {
    return undefined;
  }

  const getByIdEndpoint = inferGetByIdEndpointName(endpoint.tagType);
  const state = getState();
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal state shape
  const queries: Record<string, any> = state[api.reducerPath]?.queries ?? {};
  for (const key of Object.keys(queries)) {
    if (!key.startsWith(`${getByIdEndpoint}(`)) {
      continue;
    }
    const queryEntry = queries[key];
    if (queryEntry?.originalArgs?.id !== args.id) {
      continue;
    }
    const data = queryEntry?.data as {data?: {updated?: string}; updated?: string} | undefined;
    const updated = data?.data?.updated ?? data?.updated;
    if (typeof updated === "string") {
      return updated;
    }
  }

  return undefined;
};

const extractListCacheUpdatedAt = (
  endpoint: ResolvedOfflineEndpoint,
  originalArgs: unknown,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>
): string | undefined => {
  const args = originalArgs as {id?: string};
  if (!args?.id) {
    return undefined;
  }

  const listEndpointName = inferListEndpointName(endpoint.tagType);
  const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);
  for (const queryArg of cachedArgs) {
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape and endpoint types vary
    const listEndpoint = (api.endpoints as any)[listEndpointName];
    if (!listEndpoint?.select) {
      continue;
    }
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies
    const cacheEntry = listEndpoint.select(queryArg)(getState() as any) as any;
    const items = cacheEntry?.data?.data;
    if (Array.isArray(items)) {
      const doc = items.find((d: Record<string, unknown>) => d._id === args.id || d.id === args.id);
      if (doc?.updated) {
        return typeof doc.updated === "string"
          ? doc.updated
          : (DateTime.fromJSDate(doc.updated as Date).toISO() ?? undefined);
      }
    }
  }

  return undefined;
};

const buildQueuedMutation = ({
  endpoint,
  originalArgs,
  baseUpdatedAt,
  createdAt,
  currentUserId,
}: {
  endpoint: ResolvedOfflineEndpoint;
  originalArgs: unknown;
  baseUpdatedAt?: string;
  createdAt: string;
  currentUserId?: string;
}): QueuedMutation => {
  const args = originalArgs as {body?: Record<string, unknown>};
  const mutationId = `${endpoint.endpointName}-${DateTime.now().toMillis()}-${Math.random().toString(36).slice(2, 8)}`;
  const idStrategy = resolveOfflineIdStrategy(endpoint.idStrategy);

  let optimisticId: string | undefined;
  let body = args?.body;

  if (endpoint.operation === "create") {
    optimisticId = idStrategy.generateId();
    body = {
      ...(body ?? {}),
      [idStrategy.requestField]: optimisticId,
    };
  }

  return {
    args: endpoint.operation === "create" ? {...args, body} : originalArgs,
    attemptCount: 0,
    baseUpdatedAt,
    body,
    createdAt,
    endpointName: endpoint.endpointName,
    id: mutationId,
    idempotencyKey: mutationId,
    modelName: endpoint.modelName,
    operation: endpoint.operation,
    optimisticId,
    status: "queued",
    timestamp: createdAt,
    type: endpoint.operation,
    userId: currentUserId,
  };
};

const replayMutation = async (
  mutation: QueuedMutation,
  tagType: string
): Promise<{
  status: number;
  data?: unknown;
}> => {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  if (
    (mutation.operation === "update" || mutation.operation === "arrayUpdate") &&
    mutation.baseUpdatedAt
  ) {
    const timestamp = DateTime.fromISO(mutation.baseUpdatedAt);
    if (timestamp.isValid) {
      headers["If-Unmodified-Since"] = timestamp.toHTTP() ?? timestamp.toISO();
      headers["X-Unmodified-Since-ISO"] = mutation.baseUpdatedAt;
    }
  }

  const args = mutation.args as {id?: string; body?: unknown; field?: string; itemId?: string};
  const basePath = `/${tagType}`;

  let url: string;
  let method: string;
  let body: string | undefined;

  if (mutation.operation === "create") {
    url = `${baseUrl}${basePath}`;
    method = "POST";
    body = JSON.stringify(args?.body ?? mutation.body);
  } else if (mutation.operation === "update") {
    url = `${baseUrl}${basePath}/${args?.id}`;
    method = "PATCH";
    body = JSON.stringify(args?.body ?? mutation.body);
  } else if (mutation.operation === "delete") {
    url = `${baseUrl}${basePath}/${args?.id}`;
    method = "DELETE";
  } else if (mutation.operation === "arrayPush") {
    url = `${baseUrl}${basePath}/${args?.id}/${args?.field}`;
    method = "POST";
    body = JSON.stringify(args?.body ?? mutation.body);
  } else if (mutation.operation === "arrayUpdate") {
    url = `${baseUrl}${basePath}/${args?.id}/${args?.field}/${args?.itemId}`;
    method = "PATCH";
    body = JSON.stringify(args?.body ?? mutation.body);
  } else {
    url = `${baseUrl}${basePath}/${args?.id}/${args?.field}/${args?.itemId}`;
    method = "DELETE";
  }

  const response = await fetch(url, {body, headers, method});

  if (response.status === 204) {
    return {status: 204};
  }

  const data = await response.json();
  return {data, status: response.status};
};

const setupNativeNetworkMonitoring = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any
): (() => void) => {
  if (IsWeb) {
    return () => {};
  }

  let cleanup = (): void => {};
  void import("expo-network").then((Network) => {
    Network.getNetworkStateAsync().then((state) => {
      dispatch(setConnectionQuality(state.isConnected ? "online" : "offline"));
    });
    const subscription = Network.addNetworkStateListener((state) => {
      dispatch(setConnectionQuality(state.isConnected ? "online" : "offline"));
    });
    cleanup = () => subscription.remove();
  });

  return () => cleanup();
};

export interface ResolveConflictParams {
  conflictId: string;
  resolution: ConflictResolution;
}

export const resolveConflict = ({
  conflictId,
  resolution,
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api,
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState,
  conflicts,
}: ResolveConflictParams & {
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>;
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: (action: unknown) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any;
  conflicts: ConflictRecord[];
}): void => {
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) {
    return;
  }

  const endpoint = getConfiguredOfflineEndpoint(conflict.endpointName);
  const tagType = endpoint?.tagType ?? conflict.modelName.toLowerCase();

  if (resolution === "useServer") {
    const serverDoc = conflict.serverValue as Record<string, unknown>;
    patchCacheWithServerDocument(api, dispatch, getState, tagType, serverDoc);
    dispatch(resolveConflictUseServer(conflictId));
    dispatch(api.util.invalidateTags([tagType]));
    return;
  }

  dispatch(
    resolveConflictKeepMine({
      conflictId,
      serverUpdatedAt: conflict.serverUpdatedAt,
    })
  );

  const mutation = selectOfflineQueue(getState()).find((m) => m.id === conflict.queueId);
  if (mutation) {
    applyOptimisticUpdate(api, dispatch, getState, mutation, tagType, endpoint?.optimisticUpdate);
  }

  dispatch(setOnlineStatus(true));
};

export const createOfflineMiddleware = (
  config: OfflineMiddlewareConfig
): {
  middleware: Middleware;
  offlineReducer: typeof offlineReducer;
  offlineSlice: typeof offlineSlice;
  resolveConflict: (params: ResolveConflictParams) => void;
} => {
  const {api} = config;
  const offlineConfig = resolveOfflineConfig(config);
  configureOfflineMiddleware(offlineConfig);

  const listenerMiddleware = createListenerMiddleware();
  let _networkCleanup: (() => void) | undefined;
  let isReplayInProgress = false;

  const modelRouterAuthConfig: OfflineModelRouterConfig["auth"] | undefined =
    isModelRouterOfflineConfig(offlineConfig) ? offlineConfig.auth : undefined;

  const triggerReplayIfNeeded = (
    // biome-ignore lint/suspicious/noExplicitAny: Generic listener API
    listenerApi: any
  ): void => {
    const state = listenerApi.getState() as {offline: OfflineState};
    const quality = selectConnectionQuality(state);
    if (quality === "offline") {
      return;
    }
    if (selectIsReplayPausedForAuth(state)) {
      return;
    }
    listenerApi.dispatch(setOnlineStatus(true));
  };

  let networkInitialized = false;
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      networkInitialized = true;
      _networkCleanup = setupNativeNetworkMonitoring(listenerApi.dispatch);
    },
    predicate: () => !networkInitialized,
  });

  listenerMiddleware.startListening({
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query action types are complex
    effect: async (action: any, listenerApi) => {
      if (!isNetworkFetchError(action)) {
        return;
      }

      const endpointName = action.meta.arg.endpointName as string;
      const endpoint = getConfiguredOfflineEndpoint(endpointName);
      if (!endpoint) {
        return;
      }

      const originalArgs = action.meta.arg.originalArgs;
      const listCacheUpdatedAt = extractListCacheUpdatedAt(
        endpoint,
        originalArgs,
        listenerApi.getState,
        api
      );
      const baseUpdatedAt =
        extractBaseUpdatedAt(endpoint, originalArgs, listenerApi.getState, api) ??
        listCacheUpdatedAt;
      const createdAt = listCacheUpdatedAt ?? DateTime.now().toISO();

      const currentUserId = selectCurrentUserId(listenerApi.getState() as RootState);
      const mutation = buildQueuedMutation({
        baseUpdatedAt,
        createdAt,
        currentUserId,
        endpoint,
        originalArgs,
      });

      listenerApi.dispatch(enqueue(mutation));
      applyOptimisticUpdate(
        api,
        listenerApi.dispatch,
        listenerApi.getState,
        mutation,
        endpoint.tagType,
        endpoint.optimisticUpdate
      );

      const quality = selectConnectionQuality(listenerApi.getState() as {offline: OfflineState});
      if (quality === "online") {
        listenerApi.dispatch(setConnectionQuality("offline"));
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal action shape
    predicate: (action: any) => {
      if (typeof action?.type !== "string") {
        return false;
      }
      return (
        action.type.includes("/executeMutation/rejected") &&
        action?.meta?.arg?.endpointName &&
        getConfiguredOfflineEndpoint(action.meta.arg.endpointName) !== undefined
      );
    },
  });

  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      if (selectConnectionQuality(state) === "online") {
        listenerApi.dispatch(setConnectionQuality("offline"));
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal action shape
    predicate: (action: any) => {
      if (typeof action?.type !== "string") {
        return false;
      }
      return (
        action.type.startsWith(`${api.reducerPath}/`) &&
        (action.type.includes("/executeQuery/rejected") ||
          action.type.includes("/executeMutation/rejected")) &&
        isNetworkFetchError(action)
      );
    },
  });

  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      if (selectConnectionQuality(state) !== "online") {
        listenerApi.dispatch(setConnectionQuality("online"));
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal action shape
    predicate: (action: any) => {
      if (typeof action?.type !== "string") {
        return false;
      }
      return (
        action.type.startsWith(`${api.reducerPath}/`) &&
        action.type.endsWith("/fulfilled") &&
        (action.type.includes("/executeQuery/") || action.type.includes("/executeMutation/"))
      );
    },
  });

  listenerMiddleware.startListening({
    actionCreator: markMutationAuthBlocked,
    effect: (_action, listenerApi) => {
      listenerApi.dispatch(setSyncing(false));
    },
  });

  listenerMiddleware.startListening({
    actionCreator: resumeReplayAfterAuth,
    effect: (_action, listenerApi) => {
      triggerReplayIfNeeded(listenerApi);
    },
  });

  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      if (selectIsReplayPausedForAuth(state)) {
        listenerApi.dispatch(resumeReplayAfterAuth());
      }
    },
    type: TOKEN_REFRESHED_SUCCESS,
  });

  listenerMiddleware.startListening({
    actionCreator: setOnlineStatus,
    effect: async (action, listenerApi) => {
      if (!action.payload) {
        return;
      }

      const state = listenerApi.getState() as {offline: OfflineState};
      if (selectIsReplayPausedForAuth(state)) {
        return;
      }

      if (isReplayInProgress) {
        return;
      }
      listenerApi.cancelActiveListeners();

      const queue = selectOfflineQueue(state);
      const currentUserId = selectCurrentUserId(listenerApi.getState() as RootState);

      if (queue.length === 0) {
        if (selectIsSyncing(state)) {
          listenerApi.dispatch(setSyncing(false));
        }
        return;
      }

      isReplayInProgress = true;
      listenerApi.dispatch(setSyncing(true));

      const replayedCreates: QueuedMutation[] = [];
      const tagTypes = new Set<string>();

      try {
        for (const mutation of queue) {
          if (mutation.status === "authBlocked" || mutation.status === "conflicted") {
            continue;
          }

          if (!shouldReplayQueuedMutation(mutation, currentUserId)) {
            console.warn(
              `[offline] Dropping queued mutation ${mutation.endpointName} — not owned by current user`
            );
            listenerApi.dispatch(dequeue(mutation.id));
            continue;
          }

          const endpoint =
            getConfiguredOfflineEndpoint(mutation.endpointName) ??
            ({
              endpointName: mutation.endpointName,
              modelName: mutation.modelName,
              operation: mutation.operation,
              tagType: mutation.modelName.toLowerCase(),
            } as ResolvedOfflineEndpoint);

          tagTypes.add(endpoint.tagType);
          listenerApi.dispatch(markMutationStatus({id: mutation.id, status: "replaying"}));

          try {
            const result = await replayMutation(mutation, endpoint.tagType);

            if (result.status === 401 || result.status === 403) {
              if (modelRouterAuthConfig?.pauseReplayOnRefreshFailure !== false) {
                listenerApi.dispatch(markMutationAuthBlocked());
                break;
              }
            }

            if (result.status === 409) {
              const serverDoc = (result.data as {data?: unknown})?.data ?? result.data;
              const serverUpdatedAt =
                typeof serverDoc === "object" && serverDoc !== null
                  ? ((serverDoc as Record<string, unknown>).updated as string | undefined)
                  : undefined;

              const conflictOperation =
                mutation.operation === "create" || mutation.operation === "arrayPush"
                  ? "update"
                  : mutation.operation;

              const conflict: ConflictRecord = {
                baseUpdatedAt: mutation.baseUpdatedAt,
                createdAt: DateTime.now().toISO(),
                dismissed: false,
                endpointName: mutation.endpointName,
                id: `conflict-${mutation.id}`,
                localArgs: mutation.args,
                localBody: mutation.body,
                modelName: mutation.modelName,
                operation: conflictOperation as ConflictRecord["operation"],
                queueId: mutation.id,
                serverUpdatedAt,
                serverValue: serverDoc,
              };

              listenerApi.dispatch(addConflict(conflict));
              listenerApi.dispatch(markMutationStatus({id: mutation.id, status: "conflicted"}));
              listenerApi.dispatch(dequeue(mutation.id));

              if (endpoint.conflictStrategy === "useServer") {
                resolveConflict({
                  api,
                  conflictId: conflict.id,
                  conflicts: [conflict],
                  dispatch: listenerApi.dispatch,
                  getState: listenerApi.getState,
                  resolution: "useServer",
                });
              } else if (endpoint.conflictStrategy === "keepMine") {
                resolveConflict({
                  api,
                  conflictId: conflict.id,
                  conflicts: [conflict],
                  dispatch: listenerApi.dispatch,
                  getState: listenerApi.getState,
                  resolution: "keepMine",
                });
              }

              if (mutation.operation === "create") {
                replayedCreates.push(mutation);
              }
            } else if (result.status >= 200 && result.status < 300) {
              listenerApi.dispatch(dequeue(mutation.id));
              if (mutation.operation === "create") {
                replayedCreates.push(mutation);
              }
            } else {
              console.warn(
                `[offline] Replay failed for ${mutation.endpointName}: status ${result.status}`
              );
              if (result.status >= 400 && result.status < 500 && result.status !== 409) {
                listenerApi.dispatch(
                  markMutationStatus({
                    error: `HTTP ${result.status}`,
                    id: mutation.id,
                    status: "failed",
                  })
                );
                listenerApi.dispatch(dequeue(mutation.id));
                if (mutation.operation === "create") {
                  replayedCreates.push(mutation);
                }
              } else {
                listenerApi.dispatch(markMutationStatus({id: mutation.id, status: "queued"}));
                break;
              }
            }
          } catch (_error) {
            console.warn(`[offline] Replay network error for ${mutation.endpointName}`);
            listenerApi.dispatch(markMutationStatus({id: mutation.id, status: "queued"}));
            if (modelRouterAuthConfig?.pauseReplayOnRefreshFailure !== false) {
              listenerApi.dispatch(markMutationAuthBlocked());
            }
            break;
          }
        }

        if (replayedCreates.length > 0) {
          removeOptimisticTempItems(
            api,
            listenerApi.dispatch,
            listenerApi.getState,
            replayedCreates,
            [...tagTypes]
          );
        }

        for (const tagType of tagTypes) {
          listenerApi.dispatch(api.util.invalidateTags([tagType]));
        }
      } finally {
        isReplayInProgress = false;
        listenerApi.dispatch(setSyncing(false));
      }
    },
  });

  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      listenerApi.dispatch(clearQueue());
      listenerApi.dispatch(clearConflicts());
    },
    type: LOGOUT_ACTION_TYPE,
  });

  let startupReplayTriggered = false;
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      startupReplayTriggered = true;
      const state = listenerApi.getState() as {offline: OfflineState};
      const queue = selectOfflineQueue(state);

      if (selectIsSyncing(state) && !isReplayInProgress) {
        listenerApi.dispatch(setSyncing(false));
      }

      if (queue.length > 0 && !isReplayInProgress) {
        triggerReplayIfNeeded(listenerApi);
      }
    },
    predicate: (action) => {
      if (startupReplayTriggered) {
        return false;
      }
      return typeof action?.type === "string" && action.type === "persist/REHYDRATE";
    },
  });

  const boundResolveConflict = (params: ResolveConflictParams): void => {
    // Bound at call time via store — apps should use useOfflineStatus.resolveConflict instead
    console.warn(
      "[offline] resolveConflict from middleware return value requires store context; use useOfflineStatus().resolveConflict"
    );
  };

  return {
    middleware: listenerMiddleware.middleware,
    offlineReducer,
    offlineSlice,
    resolveConflict: boundResolveConflict,
  };
};
