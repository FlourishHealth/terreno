// biome-ignore-all lint/suspicious/noExplicitAny: RTK Query internal types require dynamic access patterns
import {useEffect, useRef} from "react";
import {useDispatch, useStore} from "react-redux";
import type {Socket} from "socket.io-client";

/**
 * A real-time sync event received from the server via WebSocket.
 * Must be kept in sync with the backend RealtimeEvent in @terreno/api.
 */
export interface RealtimeEvent {
  /** Mongoose model name (e.g. "Todo") */
  model: string;
  /** Route path used as tag type (e.g. "todos") */
  collection: string;
  /** The CRUD method that triggered this event */
  method: "create" | "update" | "delete";
  /** Document ID */
  id: string;
  /** Serialized document data (omitted for hard deletes) */
  data?: any;
  /** Fields that were updated (for update events) */
  updatedFields?: string[];
  /** Epoch milliseconds when the event was generated */
  timestamp: number;
}

interface UseSyncConnectionOptions {
  /** Socket.io client instance (from useSocketConnection) */
  socket: Socket | null;
  /** RTK Query API instance (the enhanced API with tag types) */
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query API types are complex
  api: any;
  /** Tag types to listen for (e.g. ["todos", "users"]) — these should match the collection field in events */
  tagTypes: string[];
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Hook that connects WebSocket sync events to RTK Query's cache.
 *
 * For **create** events: invalidates cache tags to trigger refetch of list queries.
 * For **update** events: patches entities in-place in cached queries, falling back to tag invalidation.
 * For **delete** events: removes entities from cached list queries, falling back to tag invalidation.
 *
 * Automatically subscribes to model rooms for each tagType when the socket connects,
 * so models using `roomStrategy: "model"` will work without additional setup.
 *
 * @example
 * ```typescript
 * const { socket } = useSocketConnection({ ... });
 *
 * useSyncConnection({
 *   socket,
 *   api: terrenoApi,
 *   tagTypes: ['todos', 'users'],
 * });
 * ```
 */
export const useSyncConnection = ({
  socket,
  api,
  tagTypes,
  debug = false,
}: UseSyncConnectionOptions): void => {
  const dispatch = useDispatch();
  const store = useStore();
  const tagTypesRef = useRef(tagTypes);
  const apiRef = useRef(api);
  tagTypesRef.current = tagTypes;
  apiRef.current = api;

  // Auto-subscribe to model rooms for each tagType when socket connects
  useEffect(() => {
    if (!socket) {
      return;
    }

    const subscribeToModels = (): void => {
      for (const tag of tagTypesRef.current) {
        socket.emit("subscribe:model", tag);
      }
    };

    // Subscribe on connect and when already connected
    if (socket.connected) {
      subscribeToModels();
    }
    socket.on("connect", subscribeToModels);

    return (): void => {
      socket.off("connect", subscribeToModels);
      // Unsubscribe from model rooms on cleanup
      if (socket.connected) {
        for (const tag of tagTypesRef.current) {
          socket.emit("unsubscribe:model", tag);
        }
      }
    };
  }, [socket]);

  // Listen for sync events and update RTK Query cache
  useEffect(() => {
    if (!socket) {
      return;
    }

    const log = (message: string): void => {
      if (debug) {
        console.debug(`[sync] ${message}`);
      }
    };

    const getApiQueries = (): Record<string, any> | null => {
      try {
        const state = store.getState();
        return state?.[apiRef.current.reducerPath]?.queries ?? null;
      } catch {
        return null;
      }
    };

    const handleSync = (event: RealtimeEvent): void => {
      const {collection, method, id, data} = event;
      const currentApi = apiRef.current;

      // Only process events for collections we care about
      if (!tagTypesRef.current.includes(collection)) {
        log(`Ignoring event for collection: ${collection}`);
        return;
      }

      log(`Received ${method} event for ${collection}/${id}`);

      switch (method) {
        case "update": {
          if (!data) {
            dispatch(currentApi.util.invalidateTags([collection]));
            break;
          }

          const queries = getApiQueries();
          if (!queries) {
            dispatch(currentApi.util.invalidateTags([collection]));
            break;
          }

          let patched = false;
          for (const [_cacheKey, queryEntry] of Object.entries(queries)) {
            const entry = queryEntry as any;
            if (entry?.status !== "fulfilled" || !entry?.data) {
              continue;
            }

            const {endpointName, originalArgs} = entry;

            // List response: {data: [...], total, page, more}
            if (entry.data?.data && Array.isArray(entry.data.data)) {
              const hasEntity = entry.data.data.some(
                (item: any) => item._id === id || item.id === id
              );
              if (hasEntity) {
                dispatch(
                  currentApi.util.updateQueryData(endpointName, originalArgs, (draft: any) => {
                    if (draft?.data && Array.isArray(draft.data)) {
                      const index = draft.data.findIndex(
                        (item: any) => item._id === id || item.id === id
                      );
                      if (index !== -1) {
                        // Stale event check via updated timestamp
                        const cachedUpdated = draft.data[index].updated;
                        if (
                          cachedUpdated &&
                          data.updated &&
                          new Date(cachedUpdated) > new Date(data.updated)
                        ) {
                          log(`Skipping stale update for ${collection}/${id}`);
                          return;
                        }
                        Object.assign(draft.data[index], data);
                      }
                    }
                  })
                );
                patched = true;
              }
            }
            // Single entity response: {_id, ...fields}
            else if (entry.data?._id === id || entry.data?.id === id) {
              const cachedUpdated = entry.data.updated;
              if (
                cachedUpdated &&
                data.updated &&
                new Date(cachedUpdated) > new Date(data.updated)
              ) {
                log(`Skipping stale update for ${collection}/${id}`);
                continue;
              }
              dispatch(
                currentApi.util.updateQueryData(endpointName, originalArgs, (draft: any) => {
                  Object.assign(draft, data);
                })
              );
              patched = true;
            }
          }

          if (!patched) {
            dispatch(currentApi.util.invalidateTags([collection]));
          }
          break;
        }

        case "delete": {
          const queries = getApiQueries();
          if (!queries) {
            dispatch(currentApi.util.invalidateTags([collection]));
            break;
          }

          let patched = false;
          for (const [_cacheKey, queryEntry] of Object.entries(queries)) {
            const entry = queryEntry as any;
            if (entry?.status !== "fulfilled" || !entry?.data) {
              continue;
            }

            const {endpointName, originalArgs} = entry;

            // List response with data array
            if (entry.data?.data && Array.isArray(entry.data.data)) {
              const hasEntity = entry.data.data.some(
                (item: any) => item._id === id || item.id === id
              );
              if (hasEntity) {
                dispatch(
                  currentApi.util.updateQueryData(endpointName, originalArgs, (draft: any) => {
                    if (draft?.data && Array.isArray(draft.data)) {
                      draft.data = draft.data.filter(
                        (item: any) => item._id !== id && item.id !== id
                      );
                      if (typeof draft.total === "number") {
                        draft.total = Math.max(0, draft.total - 1);
                      }
                    }
                  })
                );
                patched = true;
              }
            }
          }

          if (!patched) {
            dispatch(currentApi.util.invalidateTags([collection]));
          }
          break;
        }

        case "create": {
          // For creates, we can't determine filter match client-side,
          // so invalidate tags to trigger refetch of list queries
          dispatch(currentApi.util.invalidateTags([collection]));
          break;
        }
      }
    };

    socket.on("sync", handleSync);
    log("Listening for sync events");

    return (): void => {
      socket.off("sync", handleSync);
      log("Stopped listening for sync events");
    };
  }, [socket, dispatch, store, debug]);
};
