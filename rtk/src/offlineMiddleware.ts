import {
  createListenerMiddleware,
  type Middleware,
  type ThunkDispatch,
  type UnknownAction,
} from "@reduxjs/toolkit";
import {DateTime} from "luxon";

import {getAuthToken, selectCurrentUserId} from "./authSlice";
import {baseUrl, LOGOUT_ACTION_TYPE, type RootState} from "./constants";
import {configureOfflineMutationEndpoints} from "./offlineGate";
import {
  addConflict,
  type ConflictRecord,
  clearConflicts,
  clearQueue,
  dequeue,
  enqueue,
  type OfflineState,
  offlineReducer,
  offlineSlice,
  type QueuedMutation,
  selectIsOnline,
  selectIsSyncing,
  selectOfflineQueue,
  setOnlineStatus,
  setSyncing,
} from "./offlineSlice";
import {IsWeb} from "./platform";
import type {TerrenoApi} from "./terrenoApi";

interface QueryCacheEntry {
  data?: unknown;
  originalArgs?: {id?: string};
}

type AppDispatch = ThunkDispatch<RootState, unknown, UnknownAction>;
type AppGetState = () => RootState & Record<string, unknown>;

export interface OfflineMiddlewareConfig {
  /** RTK Query mutation endpoint names to queue when offline */
  endpoints: string[];
  /** The RTK Query API instance */
  api: TerrenoApi;
}

/**
 * Infer the CRUD operation type from an RTK Query endpoint name.
 * Convention: postX = create, patchX = update, deleteX = delete.
 */
const inferMutationType = (endpointName: string): "create" | "update" | "delete" => {
  if (endpointName.startsWith("post")) {
    return "create";
  }
  if (endpointName.startsWith("patch")) {
    return "update";
  }
  if (endpointName.startsWith("delete")) {
    return "delete";
  }
  return "update";
};

/**
 * True when a rejected RTK Query action failed due to a network/transport error,
 * not an auth or application-level FETCH_ERROR from emptyApi.
 */
export const isNetworkFetchError = (source: unknown): boolean => {
  const errorRecord = source as {
    error?: {message?: string; name?: string} | string;
    payload?: {error?: string};
    status?: string;
  };

  if (
    errorRecord.error &&
    typeof errorRecord.error === "object" &&
    errorRecord.error.name === "TypeError"
  ) {
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
  if (typeof errorRecord.error === "object" && typeof errorRecord.error?.message === "string") {
    candidates.push(errorRecord.error.message);
  }
  if (typeof errorRecord.error === "string") {
    candidates.push(errorRecord.error);
  }
  if (typeof errorRecord.payload?.error === "string") {
    candidates.push(errorRecord.payload.error);
  }
  if (errorRecord.status === "FETCH_ERROR" && typeof errorRecord.error === "string") {
    candidates.push(errorRecord.error);
  }

  const combined = candidates.join(" ").toLowerCase();
  return NETWORK_PATTERNS.some((p) => combined.includes(p));
};

/**
 * Whether a queued mutation may be replayed for the currently signed-in user.
 * Legacy entries without userId are discarded to avoid cross-account replay after account switch.
 */
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

/** Optimistic list item for a queued create; temp IDs are applied after body spread. */
export const buildOptimisticCreateItem = (
  mutation: QueuedMutation,
  body?: Record<string, unknown>
): Record<string, unknown> => {
  const tempId = `temp-${mutation.id}`;
  return {
    ...(body ?? {}),
    _id: tempId,
    created: mutation.timestamp,
    id: tempId,
    updated: mutation.timestamp,
  };
};

/** Derives the collection tag from an endpoint name (e.g. "patchTodosById" → "todos"). */
const inferTagType = (endpointName: string): string => {
  let name = endpointName.replace(/^(post|patch|delete)/, "").replace(/ById$/, "");
  name = name.charAt(0).toLowerCase() + name.slice(1);
  return name;
};

const inferGetByIdEndpointName = (endpointName: string): string => {
  const tagType = inferTagType(endpointName);
  const capitalized = tagType.charAt(0).toUpperCase() + tagType.slice(1);
  return `get${capitalized}ById`;
};

/**
 * Last-seen document `updated` timestamp for conflict headers on replay.
 * Prefer the patch body's `_updatedAt`, then a cached get-by-id entry.
 */
const extractBaseUpdatedAt = (
  endpointName: string,
  originalArgs: unknown,
  getState: AppGetState,
  api: TerrenoApi
): string | undefined => {
  if (inferMutationType(endpointName) !== "update") {
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

  const getByIdEndpoint = inferGetByIdEndpointName(endpointName);
  const state = getState();
  const queries: Record<string, QueryCacheEntry | undefined> =
    (state[api.reducerPath] as {queries?: Record<string, QueryCacheEntry | undefined>} | undefined)
      ?.queries ?? {};
  for (const key of Object.keys(queries)) {
    if (!key.startsWith(`${getByIdEndpoint}(`)) {
      continue;
    }
    const queryEntry = queries[key];
    if (queryEntry?.originalArgs?.id !== args.id) {
      continue;
    }
    const data = queryEntry?.data as {data?: {updated?: string}} | undefined;
    const updated = data?.data?.updated;
    if (typeof updated === "string") {
      return updated;
    }
  }

  return undefined;
};

/**
 * Collect all cached query args for a given list endpoint so optimistic
 * updates are applied to every active cache entry (regardless of the
 * args the consumer passed to the query hook, e.g. `{}` vs `undefined`).
 */
const getCachedQueryArgs = (
  getState: AppGetState,
  api: TerrenoApi,
  listEndpointName: string
): unknown[] => {
  const state = getState();
  const queries: Record<string, QueryCacheEntry | undefined> =
    (state[api.reducerPath] as {queries?: Record<string, QueryCacheEntry | undefined>} | undefined)
      ?.queries ?? {};
  const cachedArgs: unknown[] = [];
  for (const key of Object.keys(queries)) {
    if (key.startsWith(`${listEndpointName}(`)) {
      cachedArgs.push(queries[key]?.originalArgs);
    }
  }
  if (cachedArgs.length === 0) {
    cachedArgs.push(undefined);
  }
  return cachedArgs;
};

interface ListCacheDraft {
  data?: Array<Record<string, unknown>>;
}

interface RtkActionWithMeta {
  meta?: {
    arg?: {
      endpointName?: string;
      originalArgs?: unknown;
    };
  };
  type?: string;
}

interface RtkEndpointWithSelect {
  select?: (queryArg: unknown) => (state: unknown) => {data?: {data?: {updated?: string}}};
}

/**
 * Apply an optimistic update to the RTK Query cache for a queued mutation.
 */
const applyOptimisticUpdate = (
  api: TerrenoApi,
  dispatch: AppDispatch,
  getState: AppGetState,
  mutation: QueuedMutation
): void => {
  const tagType = inferTagType(mutation.endpointName);
  const listEndpointName = `get${tagType.charAt(0).toUpperCase() + tagType.slice(1)}`;
  const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);

  const updateAllCacheEntries = (updater: (draft: ListCacheDraft) => void): void => {
    for (const queryArg of cachedArgs) {
      dispatch(api.util.updateQueryData(listEndpointName as never, queryArg, updater));
    }
  };

  if (mutation.type === "create") {
    const args = mutation.args as {body?: Record<string, unknown>};
    const tempItem = buildOptimisticCreateItem(mutation, args?.body);
    updateAllCacheEntries((draft) => {
      if (draft?.data && Array.isArray(draft.data)) {
        draft.data.unshift(tempItem);
      }
    });
  } else if (mutation.type === "update") {
    const args = mutation.args as {id?: string; body?: Record<string, unknown>};
    if (args?.id && args?.body) {
      updateAllCacheEntries((draft) => {
        if (draft?.data && Array.isArray(draft.data)) {
          const item = draft.data.find((d) => d._id === args.id || d.id === args.id);
          if (item) {
            Object.assign(item, args.body);
          }
        }
      });
    }
  } else if (mutation.type === "delete") {
    const args = mutation.args as {id?: string};
    if (args?.id) {
      updateAllCacheEntries((draft) => {
        if (draft?.data && Array.isArray(draft.data)) {
          draft.data = draft.data.filter((d) => d._id !== args.id && d.id !== args.id);
        }
      });
    }
  }
};

/**
 * Remove optimistic temp items from the cache after they've been replayed.
 */
const removeTempItems = (
  api: TerrenoApi,
  dispatch: AppDispatch,
  getState: AppGetState,
  mutations: QueuedMutation[]
): void => {
  const tempIds = new Set(mutations.map((m) => `temp-${m.id}`));
  const tagTypes = [...new Set(mutations.map((m) => inferTagType(m.endpointName)))];

  for (const tagType of tagTypes) {
    const listEndpointName = `get${tagType.charAt(0).toUpperCase() + tagType.slice(1)}`;
    const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);

    for (const queryArg of cachedArgs) {
      dispatch(
        api.util.updateQueryData(listEndpointName as never, queryArg, (draft: ListCacheDraft) => {
          if (draft?.data && Array.isArray(draft.data)) {
            draft.data = draft.data.filter(
              (d) => !tempIds.has(d._id as string) && !tempIds.has(d.id as string)
            );
          }
        })
      );
    }
  }
};

/**
 * Replay a single queued mutation by making a direct API call.
 * Returns the response status and data for conflict handling.
 */
const replayMutation = async (
  mutation: QueuedMutation
): Promise<{status: number; data?: unknown}> => {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  // For update operations, include If-Unmodified-Since from the document version at queue time
  if (mutation.type === "update" && mutation.baseUpdatedAt) {
    const timestamp = DateTime.fromISO(mutation.baseUpdatedAt);
    if (timestamp.isValid) {
      headers["If-Unmodified-Since"] = timestamp.toHTTP();
      headers["X-Unmodified-Since-ISO"] = mutation.baseUpdatedAt;
    }
  }

  const args = mutation.args as {id?: string; body?: unknown};
  const tagType = inferTagType(mutation.endpointName);
  const basePath = `/${tagType}`;

  let url: string;
  let method: string;
  let body: string | undefined;

  if (mutation.type === "create") {
    url = `${baseUrl}${basePath}`;
    method = "POST";
    body = JSON.stringify(args?.body);
  } else if (mutation.type === "update") {
    url = `${baseUrl}${basePath}/${args?.id}`;
    method = "PATCH";
    body = JSON.stringify(args?.body);
  } else {
    url = `${baseUrl}${basePath}/${args?.id}`;
    method = "DELETE";
  }

  const response = await fetch(url, {body, headers, method});

  if (response.status === 204) {
    return {status: 204};
  }

  const data = await response.json();
  return {data, status: response.status};
};

/**
 * Set up native-only network monitoring (expo-network).
 * Web apps should use `useServerStatus` for server-level health checking.
 */
const setupNativeNetworkMonitoring = (dispatch: AppDispatch): (() => void) => {
  if (IsWeb) {
    return () => {};
  }

  let cleanup = (): void => {};
  void import("expo-network").then((Network) => {
    Network.getNetworkStateAsync().then((state) => {
      dispatch(setOnlineStatus(state.isConnected ?? true));
    });
    const subscription = Network.addNetworkStateListener((state) => {
      dispatch(setOnlineStatus(state.isConnected ?? true));
    });
    cleanup = () => subscription.remove();
  });

  return () => cleanup();
};

/**
 * Creates an offline middleware system for RTK Query mutations.
 *
 * When the device is offline, configured mutation endpoints are queued instead of
 * failing. When connectivity returns, queued mutations are replayed in order with
 * LWW (Last-Writer-Wins) conflict detection via If-Unmodified-Since headers.
 *
 * Usage:
 * ```typescript
 * const offline = createOfflineMiddleware({
 *   endpoints: ["postTodos", "patchTodosById", "deleteTodosById"],
 *   api: terrenoApi,
 * });
 *
 * // Add to store:
 * // reducer: { offline: offline.offlineReducer }
 * // middleware: [..., offline.middleware]
 * ```
 */
export const createOfflineMiddleware = (
  config: OfflineMiddlewareConfig
): {
  middleware: Middleware;
  offlineReducer: typeof offlineReducer;
  offlineSlice: typeof offlineSlice;
} => {
  const {endpoints, api} = config;
  const endpointSet = new Set(endpoints);
  configureOfflineMutationEndpoints(endpoints);

  const listenerMiddleware = createListenerMiddleware();
  let _networkCleanup: (() => void) | undefined;
  let isReplayInProgress = false;

  // Listener 1: Set up native network monitoring on first action (lazy init)
  let networkInitialized = false;
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      networkInitialized = true;
      _networkCleanup = setupNativeNetworkMonitoring(listenerApi.dispatch);
    },
    predicate: () => !networkInitialized,
  });

  // Listener 2: Intercept failed mutations on network errors (offline or server unreachable)
  // RTK Query dispatches actions with type "terreno-rtk/executeMutation/rejected"
  // when a mutation fails. Queue the mutation and apply an optimistic cache update.
  listenerMiddleware.startListening({
    effect: async (action: UnknownAction, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      const isOnline = selectIsOnline(state);

      if (!isNetworkFetchError(action)) {
        return;
      }

      const rejectedAction = action as UnknownAction & RtkActionWithMeta;
      const endpointName = rejectedAction.meta?.arg?.endpointName as string;
      const originalArgs = rejectedAction.meta?.arg?.originalArgs;

      const mutationType = inferMutationType(endpointName);

      // For updates, use the document's last-known `updated` timestamp from cache
      // rather than the current time. This ensures conflict detection compares against
      // when the document was last fetched, not when the mutation was queued.
      let timestamp = DateTime.now().toISO();
      let listCacheBaseUpdatedAt: string | undefined;
      if (mutationType === "update") {
        const args = originalArgs as {id?: string};
        if (args?.id) {
          const tagType = inferTagType(endpointName);
          const listEndpointName = `get${tagType.charAt(0).toUpperCase() + tagType.slice(1)}`;
          const cachedArgs = getCachedQueryArgs(listenerApi.getState, api, listEndpointName);
          for (const queryArg of cachedArgs) {
            const endpoint = (api.endpoints as Record<string, RtkEndpointWithSelect>)[
              listEndpointName
            ];
            if (!endpoint?.select) {
              continue;
            }
            const cacheEntry = endpoint.select(queryArg)(listenerApi.getState());
            const items = cacheEntry?.data?.data;
            if (Array.isArray(items)) {
              const doc = items.find(
                (d: Record<string, unknown>) => d._id === args.id || d.id === args.id
              );
              if (doc?.updated) {
                timestamp =
                  typeof doc.updated === "string"
                    ? doc.updated
                    : DateTime.fromJSDate(doc.updated).toISO();
                listCacheBaseUpdatedAt = timestamp ?? undefined;
                break;
              }
            }
          }
        }
      }

      const baseUpdatedAt =
        extractBaseUpdatedAt(endpointName, originalArgs, listenerApi.getState, api) ??
        listCacheBaseUpdatedAt;

      const currentUserId = selectCurrentUserId(listenerApi.getState() as RootState);

      const mutation: QueuedMutation = {
        args: originalArgs,
        baseUpdatedAt,
        endpointName,
        id: `${endpointName}-${DateTime.now().toMillis()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp,
        type: mutationType,
        userId: currentUserId,
      };

      listenerApi.dispatch(enqueue(mutation));
      applyOptimisticUpdate(api, listenerApi.dispatch, listenerApi.getState, mutation);

      // Browser may still report online when the API server is unreachable
      if (isOnline) {
        listenerApi.dispatch(setOnlineStatus(false));
      }
    },
    predicate: (action: UnknownAction) => {
      const typed = action as UnknownAction & RtkActionWithMeta;
      if (typeof typed.type !== "string") {
        return false;
      }
      // Match RTK Query mutation rejected actions
      return (
        typed.type.includes("/executeMutation/rejected") &&
        typed.meta?.arg?.endpointName &&
        endpointSet.has(typed.meta.arg.endpointName)
      );
    },
  });

  // Listener 3: Mark offline when any API request fails with a network error
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      if (selectIsOnline(state)) {
        listenerApi.dispatch(setOnlineStatus(false));
      }
    },
    predicate: (action: UnknownAction) => {
      const typed = action as UnknownAction & RtkActionWithMeta;
      if (typeof typed.type !== "string") {
        return false;
      }
      return (
        typed.type.startsWith(`${api.reducerPath}/`) &&
        (typed.type.includes("/executeQuery/rejected") ||
          typed.type.includes("/executeMutation/rejected")) &&
        isNetworkFetchError(action)
      );
    },
  });

  // Listener 4: Mark online when any API request succeeds (server reachable again)
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      if (!selectIsOnline(state)) {
        listenerApi.dispatch(setOnlineStatus(true));
      }
    },
    predicate: (action: UnknownAction) => {
      const typed = action as UnknownAction & RtkActionWithMeta;
      if (typeof typed.type !== "string") {
        return false;
      }
      return (
        typed.type.startsWith(`${api.reducerPath}/`) &&
        typed.type.endsWith("/fulfilled") &&
        (typed.type.includes("/executeQuery/") || typed.type.includes("/executeMutation/"))
      );
    },
  });

  // Listener 5: Sync queue when coming back online
  listenerMiddleware.startListening({
    actionCreator: setOnlineStatus,
    effect: async (action, listenerApi) => {
      if (!action.payload) {
        // Going offline, nothing to do
        return;
      }

      if (isReplayInProgress) {
        return;
      }
      listenerApi.cancelActiveListeners();

      const state = listenerApi.getState() as {offline: OfflineState};
      const queue = selectOfflineQueue(state);
      const currentUserId = selectCurrentUserId(listenerApi.getState() as RootState);

      if (queue.length === 0) {
        // Reset isSyncing if it was stuck from a crash/reload during sync
        if (selectIsSyncing(state)) {
          listenerApi.dispatch(setSyncing(false));
        }
        return;
      }

      isReplayInProgress = true;
      listenerApi.dispatch(setSyncing(true));

      const replayedCreates: QueuedMutation[] = [];

      try {
        // Replay mutations in FIFO order
        for (const mutation of queue) {
          if (!shouldReplayQueuedMutation(mutation, currentUserId)) {
            console.warn(
              `[offline] Dropping queued mutation ${mutation.endpointName} — not owned by current user`
            );
            listenerApi.dispatch(dequeue(mutation.id));
            continue;
          }

          try {
            const result = await replayMutation(mutation);

            if (result.status === 409) {
              const conflict: ConflictRecord = {
                args: mutation.args,
                dismissed: false,
                endpointName: mutation.endpointName,
                id: mutation.id,
                serverDocument: (result.data as {data?: unknown})?.data ?? result.data,
                timestamp: DateTime.now().toISO(),
              };
              listenerApi.dispatch(addConflict(conflict));
              listenerApi.dispatch(dequeue(mutation.id));
              if (mutation.type === "create") {
                replayedCreates.push(mutation);
              }
            } else if (result.status >= 200 && result.status < 300) {
              listenerApi.dispatch(dequeue(mutation.id));
              if (mutation.type === "create") {
                replayedCreates.push(mutation);
              }
            } else {
              console.warn(
                `[offline] Replay failed for ${mutation.endpointName}: status ${result.status}`
              );
              if (result.status >= 400 && result.status < 500 && result.status !== 409) {
                listenerApi.dispatch(dequeue(mutation.id));
                if (mutation.type === "create") {
                  replayedCreates.push(mutation);
                }
              }
            }
          } catch (_error) {
            console.warn(`[offline] Replay network error for ${mutation.endpointName}`);
            break;
          }
        }

        // Remove optimistic temp items for creates that were replayed
        if (replayedCreates.length > 0) {
          removeTempItems(api, listenerApi.dispatch, listenerApi.getState, replayedCreates);
        }

        // Invalidate tags to refresh cache with server state
        const tagTypes = [...new Set(queue.map((m) => inferTagType(m.endpointName)))];
        for (const tagType of tagTypes) {
          listenerApi.dispatch(api.util.invalidateTags([tagType]));
        }
      } finally {
        isReplayInProgress = false;
        listenerApi.dispatch(setSyncing(false));
      }
    },
  });

  // Listener 6: Clear persisted queue on logout so mutations are not replayed for the next user
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      listenerApi.dispatch(clearQueue());
      listenerApi.dispatch(clearConflicts());
    },
    type: LOGOUT_ACTION_TYPE,
  });

  // Listener 7: On startup, if the persisted queue has items and we're online,
  // trigger a replay. This handles the case where the app reloads while online
  // with a non-empty queue (rehydrated state already has isOnline: true, so no
  // offline→online transition would otherwise occur).
  let startupReplayTriggered = false;
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      startupReplayTriggered = true;
      const state = listenerApi.getState() as {offline: OfflineState};
      const queue = selectOfflineQueue(state);
      const isOnline = selectIsOnline(state);

      // Reset stuck isSyncing from a crash during prior sync
      if (selectIsSyncing(state) && !isReplayInProgress) {
        listenerApi.dispatch(setSyncing(false));
      }

      if (queue.length > 0 && isOnline && !isReplayInProgress) {
        // Re-dispatch setOnlineStatus(true) to trigger the sync listener
        listenerApi.dispatch(setOnlineStatus(true));
      }
    },
    predicate: (action) => {
      if (startupReplayTriggered) {
        return false;
      }
      // redux-persist dispatches "persist/REHYDRATE" after loading stored state
      return typeof action?.type === "string" && action.type === "persist/REHYDRATE";
    },
  });

  return {
    middleware: listenerMiddleware.middleware,
    offlineReducer,
    offlineSlice,
  };
};
