/**
 * Manages query subscriptions for Socket.io clients.
 *
 * When a client subscribes to a query (e.g., `{completed: false}` on the "todos" collection),
 * the query is stored here. The change stream watcher consults this store to determine
 * which query rooms should receive a given change event.
 */

interface QuerySubscription {
  collection: string;
  query: Record<string, any>;
  queryId: string;
}

/** queryId → query subscription details (shared across all sockets in that room) */
const querySubscriptions = new Map<string, QuerySubscription>();

/** socketId → set of queryIds that socket is subscribed to */
const socketQueries = new Map<string, Set<string>>();

/**
 * Register a query subscription for a socket.
 * The socket joins the `query:{queryId}` room (handled by the caller).
 */
export const addQuerySubscription = (
  socketId: string,
  collection: string,
  query: Record<string, any>,
  queryId: string
): void => {
  querySubscriptions.set(queryId, {collection, query, queryId});

  if (!socketQueries.has(socketId)) {
    socketQueries.set(socketId, new Set());
  }
  socketQueries.get(socketId)!.add(queryId);
};

/**
 * Remove a single query subscription for a socket.
 */
export const removeQuerySubscription = (socketId: string, queryId: string): void => {
  socketQueries.get(socketId)?.delete(queryId);

  // Check if any other socket still has this query
  let stillUsed = false;
  for (const [, queryIds] of socketQueries) {
    if (queryIds.has(queryId)) {
      stillUsed = true;
      break;
    }
  }

  if (!stillUsed) {
    querySubscriptions.delete(queryId);
  }
};

/**
 * Remove all query subscriptions for a disconnected socket.
 */
export const removeAllSocketQueries = (socketId: string): void => {
  const queryIds = socketQueries.get(socketId);
  if (!queryIds) {
    return;
  }

  socketQueries.delete(socketId);

  // Clean up any queries that no longer have subscribers
  for (const queryId of queryIds) {
    let stillUsed = false;
    for (const [, otherQueryIds] of socketQueries) {
      if (otherQueryIds.has(queryId)) {
        stillUsed = true;
        break;
      }
    }
    if (!stillUsed) {
      querySubscriptions.delete(queryId);
    }
  }
};

/**
 * Get all unique query subscriptions for a given collection.
 * Used by the change stream watcher to evaluate which query rooms to emit to.
 */
export const getQuerySubscriptionsForCollection = (
  collection: string
): {queryId: string; query: Record<string, any>}[] => {
  const result: {queryId: string; query: Record<string, any>}[] = [];

  for (const [queryId, sub] of querySubscriptions) {
    if (sub.collection === collection) {
      result.push({query: sub.query, queryId});
    }
  }

  return result;
};

/**
 * Clear all subscriptions (for testing).
 */
export const clearQueryStore = (): void => {
  querySubscriptions.clear();
  socketQueries.clear();
};
