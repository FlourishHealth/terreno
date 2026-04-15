import {createListenerMiddleware, type Middleware} from "@reduxjs/toolkit";
import type {Api} from "@reduxjs/toolkit/query/react";
import {DateTime} from "luxon";

import {getAuthToken} from "./authSlice";
import {baseUrl} from "./constants";
import {
  addConflict,
  type ConflictRecord,
  dequeue,
  enqueue,
  type OfflineState,
  offlineReducer,
  offlineSlice,
  type QueuedMutation,
  selectIsOnline,
  selectOfflineQueue,
  setOnlineStatus,
  setSyncing,
} from "./offlineSlice";
import {IsWeb} from "./platform";

export interface OfflineMiddlewareConfig {
  /** RTK Query mutation endpoint names to queue when offline */
  endpoints: string[];
  /** The RTK Query API instance */
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>;
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
 * Infer the tag type from an endpoint name for cache invalidation.
 * Convention: patchTodosById -> "todos", postTodos -> "todos", deleteTodosById -> "todos"
 */
const inferTagType = (endpointName: string): string => {
  // Remove prefix (post/patch/delete) and suffix (ById)
  let name = endpointName.replace(/^(post|patch|delete)/, "").replace(/ById$/, "");
  // Convert first char to lowercase
  name = name.charAt(0).toLowerCase() + name.slice(1);
  return name;
};

/**
 * Collect all cached query args for a given list endpoint so optimistic
 * updates are applied to every active cache entry (regardless of the
 * args the consumer passed to the query hook, e.g. `{}` vs `undefined`).
 */
const getCachedQueryArgs = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API state shape
  getState: () => any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  listEndpointName: string
): unknown[] => {
  const state = getState();
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal state shape
  const queries: Record<string, any> = state[api.reducerPath]?.queries ?? {};
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

/**
 * Apply an optimistic update to the RTK Query cache for a queued mutation.
 */
const applyOptimisticUpdate = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api: Api<any, any, any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any,
  // biome-ignore lint/suspicious/noExplicitAny: Generic getState
  getState: () => any,
  mutation: QueuedMutation
): void => {
  const tagType = inferTagType(mutation.endpointName);
  const listEndpointName = `get${tagType.charAt(0).toUpperCase() + tagType.slice(1)}`;
  const cachedArgs = getCachedQueryArgs(getState, api, listEndpointName);

  // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
  const updateAllCacheEntries = (updater: (draft: any) => void): void => {
    for (const queryArg of cachedArgs) {
      dispatch(
        // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
        api.util.updateQueryData(listEndpointName as any, queryArg, updater)
      );
    }
  };

  if (mutation.type === "create") {
    const args = mutation.args as {body?: Record<string, unknown>};
    const tempItem = {
      _id: `temp-${mutation.id}`,
      created: mutation.timestamp,
      id: `temp-${mutation.id}`,
      updated: mutation.timestamp,
      ...args?.body,
    };
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
    updateAllCacheEntries((draft: any) => {
      if (draft?.data && Array.isArray(draft.data)) {
        draft.data.unshift(tempItem);
      }
    });
  } else if (mutation.type === "update") {
    const args = mutation.args as {id?: string; body?: Record<string, unknown>};
    if (args?.id && args?.body) {
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
      updateAllCacheEntries((draft: any) => {
        if (draft?.data && Array.isArray(draft.data)) {
          const item = draft.data.find(
            (d: Record<string, unknown>) => d._id === args.id || d.id === args.id
          );
          if (item) {
            Object.assign(item, args.body);
          }
        }
      });
    }
  } else if (mutation.type === "delete") {
    const args = mutation.args as {id?: string};
    if (args?.id) {
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query cache shape varies by endpoint
      updateAllCacheEntries((draft: any) => {
        if (draft?.data && Array.isArray(draft.data)) {
          draft.data = draft.data.filter(
            (d: Record<string, unknown>) => d._id !== args.id && d.id !== args.id
          );
        }
      });
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

  // For update operations, include If-Unmodified-Since for conflict detection
  if (mutation.type === "update") {
    headers["If-Unmodified-Since"] = new Date(mutation.timestamp).toISOString();
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
 * Set up network monitoring. Dispatches setOnlineStatus when connectivity changes.
 */
const setupNetworkMonitoring = (
  // biome-ignore lint/suspicious/noExplicitAny: Generic dispatch
  dispatch: any
): (() => void) => {
  if (IsWeb) {
    if (typeof window === "undefined") {
      return () => {};
    }
    const handleOnline = () => dispatch(setOnlineStatus(true));
    const handleOffline = () => dispatch(setOnlineStatus(false));

    // Set initial state
    dispatch(setOnlineStatus(navigator.onLine));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  // Native: use expo-network
  let cleanup = (): void => {};
  void import("expo-network").then((Network) => {
    // Set initial state
    Network.getNetworkStateAsync().then((state) => {
      dispatch(setOnlineStatus(state.isConnected ?? true));
    });
    // Subscribe to changes
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

  const listenerMiddleware = createListenerMiddleware();
  let _networkCleanup: (() => void) | undefined;

  // Listener 1: Set up network monitoring on first action (lazy init)
  let networkInitialized = false;
  listenerMiddleware.startListening({
    effect: (_action, listenerApi) => {
      networkInitialized = true;
      _networkCleanup = setupNetworkMonitoring(listenerApi.dispatch);
    },
    predicate: () => !networkInitialized,
  });

  // Listener 2: Intercept failed mutations when offline
  // RTK Query dispatches actions with type "terreno-rtk/executeMutation/rejected"
  // when a mutation fails. When offline, we catch FETCH_ERROR and queue the mutation.
  listenerMiddleware.startListening({
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query action types are complex
    effect: async (action: any, listenerApi) => {
      const state = listenerApi.getState() as {offline: OfflineState};
      const isOnline = selectIsOnline(state);

      // Only queue if offline and the error is a network error
      const isFetchError =
        action?.payload?.status === "FETCH_ERROR" ||
        action?.error?.message?.includes("fetch") ||
        action?.error?.message?.includes("network") ||
        action?.error?.name === "TypeError";

      if (isOnline || !isFetchError) {
        return;
      }

      const endpointName = action.meta.arg.endpointName as string;
      const originalArgs = action.meta.arg.originalArgs;

      const mutation: QueuedMutation = {
        args: originalArgs,
        endpointName,
        id: `${endpointName}-${DateTime.now().toMillis()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: DateTime.now().toISO(),
        type: inferMutationType(endpointName),
      };

      listenerApi.dispatch(enqueue(mutation));
      applyOptimisticUpdate(api, listenerApi.dispatch, listenerApi.getState, mutation);
    },
    // biome-ignore lint/suspicious/noExplicitAny: RTK Query internal action shape
    predicate: (action: any) => {
      if (typeof action?.type !== "string") {
        return false;
      }
      // Match RTK Query mutation rejected actions
      return (
        action.type.includes("/executeMutation/rejected") &&
        action?.meta?.arg?.endpointName &&
        endpointSet.has(action.meta.arg.endpointName)
      );
    },
  });

  // Listener 3: Sync queue when coming back online
  listenerMiddleware.startListening({
    actionCreator: setOnlineStatus,
    effect: async (action, listenerApi) => {
      if (!action.payload) {
        // Going offline, nothing to do
        return;
      }

      const state = listenerApi.getState() as {offline: OfflineState};
      const queue = selectOfflineQueue(state);

      if (queue.length === 0) {
        return;
      }

      listenerApi.dispatch(setSyncing(true));

      // Replay mutations in FIFO order
      for (const mutation of queue) {
        try {
          const result = await replayMutation(mutation);

          if (result.status === 409) {
            // Conflict detected - server version is newer
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
          } else if (result.status >= 200 && result.status < 300) {
            // Success
            listenerApi.dispatch(dequeue(mutation.id));
          } else {
            // Other error - leave in queue for retry
            console.warn(
              `[offline] Replay failed for ${mutation.endpointName}: status ${result.status}`,
              result.data
            );
            // Dequeue anyway to avoid infinite retry loops for permanent errors (400, 403, etc.)
            if (result.status >= 400 && result.status < 500 && result.status !== 409) {
              listenerApi.dispatch(dequeue(mutation.id));
            }
          }
        } catch (error) {
          // Network error during replay - stop syncing, will retry when online again
          console.warn(`[offline] Replay error for ${mutation.endpointName}:`, error);
          break;
        }
      }

      // Invalidate tags to refresh cache with server state
      const tagTypes = [...new Set(queue.map((m) => inferTagType(m.endpointName)))];
      for (const tagType of tagTypes) {
        listenerApi.dispatch(api.util.invalidateTags([tagType]));
      }

      listenerApi.dispatch(setSyncing(false));
    },
  });

  return {
    middleware: listenerMiddleware.middleware,
    offlineReducer,
    offlineSlice,
  };
};
