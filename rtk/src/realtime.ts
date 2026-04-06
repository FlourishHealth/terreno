// biome-ignore-all lint/suspicious/noExplicitAny: RTK Query internal types require dynamic access patterns
import {DateTime} from "luxon";
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

// ---------------------------------------------------------------------------
// Socket management
// ---------------------------------------------------------------------------

let _socket: Socket | null = null;
const _socketWaiters: ((socket: Socket) => void)[] = [];

/**
 * Provide the Socket.io client instance used by `realtimeDocument` and `realtimeList`.
 *
 * Call this once after your socket connects (e.g. inside `useSocketConnection`'s `onConnect`
 * callback, or in a `useEffect` that watches the socket ref).
 *
 * @example
 * ```typescript
 * const { socket } = useSocketConnection({ ... });
 *
 * useEffect(() => {
 *   setRealtimeSocket(socket);
 *   return () => setRealtimeSocket(null);
 * }, [socket]);
 * ```
 */
export const setRealtimeSocket = (socket: Socket | null): void => {
  _socket = socket;
  if (socket) {
    while (_socketWaiters.length > 0) {
      const waiter = _socketWaiters.shift();
      waiter?.(socket);
    }
  }
};

/** Get the current socket instance (may be null). */
export const getRealtimeSocket = (): Socket | null => _socket;

/**
 * Returns a promise that resolves as soon as a socket is available.
 * Accepts an optional abort promise — if it resolves first, returns null
 * so the caller can bail out (e.g. when the cache entry is removed).
 */
const waitForSocket = (abort?: Promise<void>): Promise<Socket | null> => {
  if (_socket) {
    return Promise.resolve(_socket);
  }
  const socketPromise = new Promise<Socket>((resolve) => {
    _socketWaiters.push(resolve);
  });
  if (!abort) {
    return socketPromise;
  }
  return Promise.race([socketPromise, abort.then(() => null)]);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keys that represent pagination/sorting, not document field filters. */
const PAGINATION_KEYS = new Set(["limit", "page", "sort", "skip", "offset", "cursor"]);

/**
 * Strip pagination params from a query argument to get just the filter.
 * Returns undefined if no filter fields remain.
 */
const extractQueryFilter = (arg: any): Record<string, any> | undefined => {
  if (!arg || typeof arg !== "object") {
    return undefined;
  }
  const filter: Record<string, any> = {};
  for (const [key, value] of Object.entries(arg)) {
    if (!PAGINATION_KEYS.has(key)) {
      filter[key] = value;
    }
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
};

/** Deterministic hash for a query object — used as the room ID. */
const hashQuery = (collection: string, query: Record<string, any>): string => {
  const sortedKeys = Object.keys(query).sort();
  const normalized: Record<string, any> = {};
  for (const key of sortedKeys) {
    normalized[key] = query[key];
  }
  return `${collection}:${JSON.stringify(normalized)}`;
};

// ---------------------------------------------------------------------------
// onCacheEntryAdded factories
// ---------------------------------------------------------------------------

interface RealtimeDocumentOptions {
  /**
   * Extract the document ID from the RTK Query argument.
   * Defaults to `arg` if string, or `arg.id ?? arg._id`.
   */
  getId?: (arg: any) => string | undefined;
}

/**
 * Factory that returns an `onCacheEntryAdded` callback for real-time
 * updates on a **single document**.
 *
 * Subscribes to `document:{collection}:{id}` room on the server. When a sync
 * event arrives for this document, patches the RTK Query cache in-place.
 *
 * @param collection - The collection tag (e.g. "todos")
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * const api = generatedApi.enhanceEndpoints({
 *   endpoints: {
 *     getTodosIdRead: {
 *       onCacheEntryAdded: realtimeDocument("todos"),
 *     },
 *   },
 * });
 * ```
 */
export const realtimeDocument = (collection: string, options?: RealtimeDocumentOptions) => {
  const getId =
    options?.getId ?? ((arg: any) => (typeof arg === "string" ? arg : (arg?.id ?? arg?._id)));

  return async (arg: any, api: any): Promise<void> => {
    const {updateCachedData, cacheDataLoaded, cacheEntryRemoved} = api;

    const id = getId(arg);
    if (!id) {
      return;
    }

    try {
      await cacheDataLoaded;
    } catch {
      return;
    }

    const socket = await waitForSocket(cacheEntryRemoved);
    if (!socket) {
      return;
    }

    socket.emit("subscribe:document", {collection, id});

    const handleSync = (event: RealtimeEvent): void => {
      if (event.collection !== collection || event.id !== id) {
        return;
      }

      if (event.method === "update" && event.data) {
        updateCachedData((draft: any) => {
          Object.assign(draft, event.data);
        });
      }

      // For deletes, the cache entry will be invalidated by tag invalidation
      // or the consuming component can handle the deleted state.
    };

    socket.on("sync", handleSync);

    await cacheEntryRemoved;
    socket.off("sync", handleSync);
    socket.emit("unsubscribe:document", {collection, id});
  };
};

interface RealtimeListOptions {
  /**
   * Extract the query filter from the RTK Query argument.
   * Defaults to stripping pagination keys (limit, page, sort, skip, offset, cursor).
   * Return undefined to subscribe to the model room instead of a query room.
   */
  getQuery?: (arg: any) => Record<string, any> | undefined;
}

interface QuerySubscribedEvent {
  collection: string;
  queryId: string;
  clientQueryId?: string;
}

/**
 * Factory that returns an `onCacheEntryAdded` callback for real-time
 * updates on a **list of documents**, optionally filtered by query.
 *
 * If the query argument contains filter fields (after stripping pagination params),
 * subscribes to `query:{queryId}` so the server only sends matching events.
 * Otherwise subscribes to `model:{collection}` for all events.
 *
 * Handles:
 * - **create** → prepends new document to the list
 * - **update** → patches existing document in-place, or adds it if newly matching
 * - **delete** → removes document from the list
 *
 * @param collection - The collection tag (e.g. "todos")
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * const api = generatedApi.enhanceEndpoints({
 *   endpoints: {
 *     getTodosList: {
 *       onCacheEntryAdded: realtimeList("todos"),
 *     },
 *   },
 * });
 * ```
 */
export const realtimeList = (collection: string, options?: RealtimeListOptions) => {
  const getQuery = options?.getQuery ?? extractQueryFilter;

  return async (arg: any, api: any): Promise<void> => {
    const {updateCachedData, cacheDataLoaded, cacheEntryRemoved} = api;

    try {
      await cacheDataLoaded;
    } catch {
      return;
    }

    const socket = await waitForSocket(cacheEntryRemoved);
    if (!socket) {
      return;
    }

    const query = getQuery(arg);
    let queryId: string | undefined;
    let handleQuerySubscribed: ((event: QuerySubscribedEvent) => void) | undefined;

    if (query) {
      const clientQueryId = hashQuery(collection, query);
      queryId = clientQueryId;

      handleQuerySubscribed = (event: QuerySubscribedEvent): void => {
        if (event.collection !== collection || event.clientQueryId !== clientQueryId) {
          return;
        }
        queryId = event.queryId;
      };

      socket.on("query:subscribed", handleQuerySubscribed);
      socket.emit("subscribe:query", {collection, query, queryId: clientQueryId});
    } else {
      socket.emit("subscribe:model", collection);
    }

    const handleSync = (event: RealtimeEvent): void => {
      if (event.collection !== collection) {
        return;
      }

      switch (event.method) {
        case "create": {
          if (event.data) {
            updateCachedData((draft: any) => {
              if (draft?.data && Array.isArray(draft.data)) {
                draft.data.unshift(event.data);
                if (typeof draft.total === "number") {
                  draft.total += 1;
                }
              }
            });
          }
          break;
        }

        case "update": {
          if (event.data) {
            updateCachedData((draft: any) => {
              if (draft?.data && Array.isArray(draft.data)) {
                const index = draft.data.findIndex(
                  (item: any) => item._id === event.id || item.id === event.id
                );
                if (index !== -1) {
                  // Stale event check
                  const cachedUpdated = draft.data[index].updated;
                  if (
                    cachedUpdated &&
                    event.data.updated &&
                    DateTime.fromISO(cachedUpdated) > DateTime.fromISO(event.data.updated)
                  ) {
                    return;
                  }
                  Object.assign(draft.data[index], event.data);
                } else {
                  // Document newly matches query — add it to the list
                  draft.data.unshift(event.data);
                  if (typeof draft.total === "number") {
                    draft.total += 1;
                  }
                }
              }
            });
          }
          break;
        }

        case "delete": {
          updateCachedData((draft: any) => {
            if (draft?.data && Array.isArray(draft.data)) {
              const before = draft.data.length;
              draft.data = draft.data.filter(
                (item: any) => item._id !== event.id && item.id !== event.id
              );
              if (draft.data.length < before && typeof draft.total === "number") {
                draft.total = Math.max(0, draft.total - 1);
              }
            }
          });
          break;
        }
      }
    };

    socket.on("sync", handleSync);

    await cacheEntryRemoved;
    socket.off("sync", handleSync);
    if (handleQuerySubscribed) {
      socket.off("query:subscribed", handleQuerySubscribed);
    }

    if (queryId) {
      socket.emit("unsubscribe:query", {queryId});
    } else {
      socket.emit("unsubscribe:model", collection);
    }
  };
};
