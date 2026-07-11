// biome-ignore-all lint/suspicious/noExplicitAny: Socket.io handler signatures require dynamic args
import type {Server} from "socket.io";

import type {User} from "../auth";
import {logger} from "../logger";
import {checkPermissions} from "../permissions";
import {getSocketUser, type SocketWithDecodedToken} from "../realtime/socketUser";
import {
  applySyncMutation,
  applySyncMutationBatch,
  MAX_SYNC_MUTATIONS_PER_BATCH,
  type SyncMutationOutcome,
  validateSyncMutationBatch,
} from "./mutationHandler";
import {findSyncEntryByCollectionTag, type SyncRegistryEntry} from "./registry";
import type {SyncAppOptions} from "./routes";
import {streamForScopeValue} from "./streams";
import type {
  SyncMutateBatchRequest,
  SyncMutateBatchResponse,
  SyncMutateRequest,
  SyncNack,
} from "./types";

/**
 * Socket handlers for the SyncDB local-first protocol:
 *
 * - `sync:subscribe {collections}` / `sync:unsubscribe {collections}` — resolves the
 *   caller's streams from the sync registry scope config and joins/leaves `sync:{stream}`
 *   rooms. Owner scopes always use the socket's own userId (never a client-supplied one);
 *   tenant and custom scopes resolve stream values via `SyncAppOptions.getUserScopes`.
 *   Sync deltas fan out through these dedicated `sync:{stream}` rooms rather than the
 *   legacy realtime rooms so the two event families never overlap.
 * - `sync:mutate` — applies a mutation through `applySyncMutation` and replies with
 *   `sync:ack {mutationId, id, seq}` or `sync:nack {mutationId, code, ...}`; when the
 *   client supplied a Socket.io ack callback it also receives `{ack}` / `{nack}`.
 * - `sync:error {collection, message}` — emitted for per-collection subscribe failures
 *   (unknown collection, permission denied, missing scope resolver, cap exceeded).
 *
 * ## Wiring
 *
 * `RealtimeApp` installs these handlers on every connection, reading the active
 * `SyncAppOptions` registered by the `SyncApp` plugin (`setActiveSyncAppOptions`), so
 * `getUserScopes` is configured exactly once — on `SyncApp` — regardless of plugin
 * registration order.
 */

/** Maximum distinct collection subscriptions per socket (DoS protection). */
export const MAX_SYNC_COLLECTION_SUBSCRIPTIONS = 50;

/** Maximum `sync:mutate` requests accepted per socket per second. */
export const MAX_SYNC_MUTATIONS_PER_SECOND = 100;

/** The Socket.io room a sync stream fans out through. */
export const syncRoomForStream = (stream: string): string => `sync:${stream}`;

/**
 * Active SyncAppOptions shared between the SyncApp plugin (which owns configuration such
 * as `getUserScopes`) and RealtimeApp's connection handler (which installs the socket
 * handlers). Module-level like the sync registry so plugin registration order is
 * irrelevant.
 */
let activeSyncAppOptions: SyncAppOptions | null = null;

/** Called by SyncApp.register so socket handlers share the plugin's options. */
export const setActiveSyncAppOptions = (options: SyncAppOptions): void => {
  activeSyncAppOptions = options;
};

/** The options registered by the SyncApp plugin, if any. */
export const getActiveSyncAppOptions = (): SyncAppOptions | null => activeSyncAppOptions;

/** Clear the active options (for testing). */
export const clearActiveSyncAppOptions = (): void => {
  activeSyncAppOptions = null;
};

/**
 * Minimal shape this module requires from a Socket.io socket. Matches
 * `RealtimeSocketLike` structurally so tests can drive handlers with a mock socket.
 */
export interface SyncSocketLike extends SocketWithDecodedToken {
  id: string;
  join: (room: string) => Promise<void> | void;
  leave: (room: string) => Promise<void> | void;
  emit: (event: string, payload: unknown) => void;
  on: (event: string, handler: (...args: any[]) => any) => void;
}

/**
 * Resolve the streams a user may subscribe to for a collection. Returns null (after
 * emitting `sync:error`) when the scope cannot be resolved for this user/server config.
 */
const resolveUserStreams = async ({
  entry,
  user,
  options,
  socket,
}: {
  entry: SyncRegistryEntry;
  user: User;
  options: SyncAppOptions;
  socket: SyncSocketLike;
}): Promise<string[] | null> => {
  const {scope} = entry.config;
  const collection = entry.collectionTag;
  const emitError = (message: string): void => {
    socket.emit("sync:error", {collection, message});
  };

  if (typeof scope !== "function" && scope.type === "broadcast") {
    return [streamForScopeValue({collectionTag: collection, scope, scopeValue: null})];
  }
  if (typeof scope !== "function" && scope.type === "owner") {
    // Owner streams are always keyed by the authenticated socket's own userId — a
    // client-supplied id must never select the stream.
    return [streamForScopeValue({collectionTag: collection, scope, scopeValue: user.id})];
  }

  // Tenant and custom scopes need the server-configured membership resolver.
  if (!options.getUserScopes) {
    emitError(`Sync collection ${collection} requires a getUserScopes resolver on SyncApp`);
    return null;
  }
  let scopeValues: string[];
  try {
    scopeValues = await options.getUserScopes(user, entry);
  } catch (error: unknown) {
    logger.error(`[sync] getUserScopes threw for ${collection}: ${error}`);
    emitError(`Failed to resolve scopes for ${collection}`);
    return null;
  }
  return scopeValues.map((scopeValue) =>
    streamForScopeValue({collectionTag: collection, scope, scopeValue})
  );
};

/**
 * Install the sync socket handlers on a single socket. Wired into RealtimeApp's
 * connection handler alongside `installRealtimeSocketHandlers`.
 *
 * The `_io` server parameter is accepted for signature symmetry with future fan-out
 * needs; the current handlers only act on the connecting socket.
 */
export const installSyncSocketHandlers = (
  _io: Server | null,
  socket: SyncSocketLike,
  options: SyncAppOptions = {},
  handlerOptions: {logInfo?: (msg: string) => void} = {}
): void => {
  const logInfo = handlerOptions.logInfo ?? ((): void => {});
  const user = getSocketUser(socket);
  const userId = socket.decodedToken?.id;

  // collection tag -> joined sync rooms, for unsubscribe/disconnect cleanup.
  const subscriptions = new Map<string, Set<string>>();

  // Rolling one-second window for the sync:mutate / sync:mutateBatch rate limit —
  // shared between both events so a batch counts each of its mutations against the
  // same budget as individual sync:mutate calls (not once per batch).
  let mutationWindowStart = 0;
  let mutationCount = 0;

  /** Returns true when `weight` more mutations would exceed the per-second budget. */
  const consumeMutationRateLimit = (weight: number): boolean => {
    const now = Date.now();
    if (now - mutationWindowStart >= 1000) {
      mutationWindowStart = now;
      mutationCount = 0;
    }
    mutationCount += weight;
    return mutationCount > MAX_SYNC_MUTATIONS_PER_SECOND;
  };

  socket.on("sync:subscribe", async (payload: {collections?: unknown}): Promise<void> => {
    const collections = Array.isArray(payload?.collections) ? payload.collections : null;
    if (!collections) {
      return;
    }
    for (const collection of collections) {
      if (typeof collection !== "string" || collection.length === 0) {
        continue;
      }
      if (subscriptions.has(collection)) {
        // Already subscribed — idempotent.
        continue;
      }
      if (subscriptions.size >= MAX_SYNC_COLLECTION_SUBSCRIPTIONS) {
        logInfo(`[sync] User ${userId} hit sync collection subscription limit`);
        socket.emit("sync:error", {
          collection,
          message: `Sync subscription limit of ${MAX_SYNC_COLLECTION_SUBSCRIPTIONS} collections reached`,
        });
        continue;
      }
      const entry = findSyncEntryByCollectionTag(collection);
      if (!entry) {
        socket.emit("sync:error", {collection, message: `Unknown sync collection: ${collection}`});
        continue;
      }
      if (!user) {
        socket.emit("sync:error", {collection, message: "Authentication required"});
        continue;
      }
      if (!(await checkPermissions("list", entry.options.permissions.list, user))) {
        logInfo(`[sync] User ${userId} denied sync subscription for ${collection}`);
        socket.emit("sync:error", {
          collection,
          message: `Access to sync collection ${collection} denied`,
        });
        continue;
      }
      const streams = await resolveUserStreams({entry, options, socket, user});
      if (!streams) {
        continue;
      }
      const rooms = new Set(streams.map(syncRoomForStream));
      for (const room of rooms) {
        await socket.join(room);
      }
      subscriptions.set(collection, rooms);
      socket.emit("sync:subscribed", {collection, streams});
      logInfo(`[sync] User ${userId} subscribed to ${collection}: ${streams.join(", ")}`);
    }
  });

  socket.on("sync:unsubscribe", async (payload: {collections?: unknown}): Promise<void> => {
    const collections = Array.isArray(payload?.collections) ? payload.collections : null;
    if (!collections) {
      return;
    }
    for (const collection of collections) {
      if (typeof collection !== "string") {
        continue;
      }
      const rooms = subscriptions.get(collection);
      if (!rooms) {
        continue;
      }
      for (const room of rooms) {
        await socket.leave(room);
      }
      subscriptions.delete(collection);
      logInfo(`[sync] User ${userId} unsubscribed from ${collection}`);
    }
  });

  socket.on(
    "sync:mutate",
    async (payload: SyncMutateRequest, ack?: (response: unknown) => void): Promise<void> => {
      const respond = (outcome: SyncMutationOutcome): void => {
        if (outcome.type === "ack") {
          socket.emit("sync:ack", outcome.ack);
        } else {
          socket.emit("sync:nack", outcome.nack);
        }
        if (typeof ack === "function") {
          ack(outcome.type === "ack" ? {ack: outcome.ack} : {nack: outcome.nack});
        }
      };
      const nack = (partial: Omit<SyncNack, "mutationId">): void => {
        respond({
          nack: {
            mutationId: typeof payload?.mutationId === "string" ? payload.mutationId : "",
            ...partial,
          },
          type: "nack",
        });
      };

      if (consumeMutationRateLimit(1)) {
        logInfo(`[sync] User ${userId} hit the sync:mutate rate limit`);
        nack({
          code: "error",
          message: `Rate limit of ${MAX_SYNC_MUTATIONS_PER_SECOND} mutations per second exceeded`,
        });
        return;
      }

      if (!user) {
        nack({code: "unauthorized", message: "Authentication required"});
        return;
      }

      try {
        respond(await applySyncMutation({mutation: payload, user}));
      } catch (error: unknown) {
        logger.error(`[sync] sync:mutate failed for socket ${socket.id}: ${error}`);
        nack({code: "error", message: "Internal error applying mutation"});
      }
    }
  );

  socket.on(
    "sync:mutateBatch",
    async (payload: SyncMutateBatchRequest, ack?: (response: unknown) => void): Promise<void> => {
      const respondBatch = (response: SyncMutateBatchResponse): void => {
        if (typeof ack === "function") {
          ack(response);
        }
      };
      const singleNackBatch = (partial: Omit<SyncNack, "mutationId">, mutationId = ""): void => {
        respondBatch({results: [{nack: {mutationId, ...partial}, type: "nack"}]});
      };

      const mutations = Array.isArray(payload?.mutations) ? payload.mutations : [];

      // Batch size cap enforced before rate limiting or auth checks — an oversized
      // batch is a client bug, rejected loudly with no side effects.
      if (mutations.length > MAX_SYNC_MUTATIONS_PER_BATCH) {
        const validation = validateSyncMutationBatch(mutations);
        if (!validation.ok) {
          respondBatch(validation.response);
          return;
        }
      }

      // The rate limiter counts each mutation in the batch (not the batch itself)
      // against the same window sync:mutate uses.
      if (consumeMutationRateLimit(mutations.length)) {
        logInfo(`[sync] User ${userId} hit the sync:mutateBatch rate limit`);
        singleNackBatch({
          code: "error",
          message: `Rate limit of ${MAX_SYNC_MUTATIONS_PER_SECOND} mutations per second exceeded`,
        });
        return;
      }

      if (!user) {
        singleNackBatch({code: "unauthorized", message: "Authentication required"});
        return;
      }

      const validation = validateSyncMutationBatch(mutations);
      if (!validation.ok) {
        respondBatch(validation.response);
        return;
      }

      try {
        respondBatch(await applySyncMutationBatch({mutations, user}));
      } catch (error: unknown) {
        logger.error(`[sync] sync:mutateBatch failed for socket ${socket.id}: ${error}`);
        singleNackBatch({code: "error", message: "Internal error applying batch"});
      }
    }
  );

  socket.on("disconnect", () => {
    subscriptions.clear();
  });
};
