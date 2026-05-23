// biome-ignore-all lint/suspicious/noExplicitAny: change stream and socket handlers use dynamic document shapes
import * as Sentry from "@sentry/bun";
import type express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import type {Server, Socket} from "socket.io";

type ChangeStream = mongoose.mongo.ChangeStream;
type ChangeStreamDocument = mongoose.mongo.ChangeStreamDocument;
type ChangeStreamOptions = mongoose.mongo.ChangeStreamOptions;

/**
 * The subset of ChangeStreamDocument variants this watcher actually processes.
 * The pipeline filters for ["insert", "update", "replace", "delete"], so we never
 * see drop / rename / invalidate / index events at runtime.
 */
type WatchedChange = Extract<
  ChangeStreamDocument,
  {operationType: "insert" | "update" | "replace" | "delete"}
>;

import type {User} from "../auth";
import {logger} from "../logger";
import {checkPermissions} from "../permissions";
import {matchesQuery} from "./queryMatcher";
import {getQuerySubscriptionsForCollection} from "./queryStore";
import {findRegistryEntryByCollection, type RealtimeRegistryEntry} from "./registry";
import type {ChangeStreamConfig, RealtimeEvent} from "./types";

let changeWatcher: ChangeStream | null = null;

const DEFAULT_IGNORED_COLLECTIONS = ["socketio", "sessions"];

/**
 * Map MongoDB change stream operation types to our method names.
 *
 * Soft deletes (an `update` that sets `deleted: true`) are reclassified as
 * `"delete"` only when the model has `"delete"` enabled in its realtime
 * methods. Otherwise they fall back to `"update"` so models that subscribe
 * to updates (but not deletes) still see the change — without this fallback,
 * a model configured with `methods: ["create", "update"]` would silently
 * drop soft-delete events.
 *
 * Exported for testing.
 */
export const mapOperationType = (
  operationType: string,
  change: ChangeStreamDocument,
  enabledMethods: ReadonlyArray<"create" | "update" | "delete"> = ["create", "update", "delete"]
): "create" | "update" | "delete" | null => {
  if (operationType === "insert") {
    return "create";
  }
  if (operationType === "update" || operationType === "replace") {
    // Soft delete on an update event: the document was patched with deleted=true.
    // `change` is typed as the full union (without operationType narrowing) because
    // callers/tests pass change objects without setting `operationType` on the change.
    const updateChange = change as Extract<ChangeStreamDocument, {operationType: "update"}>;
    const isSoftDelete =
      operationType === "update" && updateChange.updateDescription?.updatedFields?.deleted === true;
    if (isSoftDelete && enabledMethods.includes("delete")) {
      return "delete";
    }
    return "update";
  }
  if (operationType === "delete") {
    return "delete";
  }
  return null;
};

/**
 * Get the collection tag from a route path (strips leading "/").
 * E.g. "/todos" -> "todos"
 */
const getCollectionTag = (routePath: string): string => routePath.replace(/^\//, "");

interface RealtimeSocketWithAuth extends Socket {
  decodedToken?: {id?: string; admin?: boolean; isAnonymous?: boolean};
}

const getSocketUser = (socket: RealtimeSocketWithAuth): User | undefined => {
  const userId = socket.decodedToken?.id;
  if (!userId) {
    return undefined;
  }
  return {
    _id: userId,
    admin: socket.decodedToken?.admin === true,
    id: userId,
    isAnonymous: socket.decodedToken?.isAnonymous,
  };
};

const getSocketsInRoom = (io: Server, room: string): RealtimeSocketWithAuth[] => {
  const socketIds = io.sockets.adapter.rooms.get(room);
  if (!socketIds) {
    return [];
  }

  const sockets: RealtimeSocketWithAuth[] = [];
  for (const socketId of socketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      sockets.push(socket as RealtimeSocketWithAuth);
    }
  }
  return sockets;
};

const canReadDocument = async (
  entry: RealtimeRegistryEntry,
  user?: User,
  doc?: any
): Promise<boolean> => {
  return checkPermissions("read", entry.options.permissions.read, user, doc);
};

/**
 * Determine which Socket.io rooms to emit to based on the room strategy.
 * Exported for testing.
 */
export const resolveRooms = (entry: RealtimeRegistryEntry, doc: any, method: string): string[] => {
  const {roomStrategy} = entry.config;
  // Use the collection tag (e.g. "todos") for model rooms, matching what the frontend subscribes to
  const collectionTag = getCollectionTag(entry.routePath);

  if (typeof roomStrategy === "function") {
    // Custom room resolver — pass a minimal pseudo-request. The strategy only inspects
    // doc/method; we never read fields off req here, so an empty cast is safe.
    return roomStrategy(doc, method, {} as unknown as express.Request);
  }

  switch (roomStrategy) {
    case "owner": {
      const ownerId = doc?.ownerId?.toString?.() ?? doc?.ownerId;
      if (ownerId) {
        return [`user:${ownerId}`];
      }
      // If no ownerId, fall back to model room
      return [`model:${collectionTag}`];
    }
    case "model":
      return [`model:${collectionTag}`];
    case "broadcast":
      return ["authenticated"];
    default:
      return [`model:${collectionTag}`];
  }
};

/**
 * Ensure serialized documents include `id` to match REST API responses.
 * Change stream fullDocument payloads are raw BSON objects with `_id` only.
 */
export const ensureApiId = (data: unknown): unknown => {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const serialized = data as Record<string, unknown>;
  if (serialized._id != null && serialized.id == null) {
    return {...serialized, id: serialized._id};
  }
  return data;
};

/**
 * Serialize a document for emission.
 *
 * Precedence:
 *   1. `realtimeResponseHandler` if provided (full control over what's emitted).
 *   2. modelRouter `responseHandler` if provided — invoked with a synthetic request
 *      so the same stripping logic used for REST responses (e.g. removing `hash`/`salt`)
 *      applies to realtime events. This prevents accidental leaks when an app only
 *      configures sanitization in the REST `responseHandler`.
 *   3. `toJSON()` fallback.
 *
 * If a user-supplied handler throws, we re-throw so the caller's outer try/catch
 * records the failure and the event is dropped. Falling back to `toJSON()` here
 * would risk leaking unsanitized fields (e.g. `hash`/`salt`) that the handler
 * was supposed to strip.
 */
export const serializeDoc = async (
  entry: RealtimeRegistryEntry,
  doc: any,
  method: "create" | "update" | "delete",
  user?: User
): Promise<any> => {
  if (entry.config.realtimeResponseHandler) {
    try {
      return ensureApiId(await entry.config.realtimeResponseHandler(doc, method));
    } catch (error) {
      logger.error(
        `[realtime] realtimeResponseHandler threw for ${entry.modelName}/${method}: ${error}. ` +
          "Dropping event to avoid leaking unsanitized data."
      );
      throw error;
    }
  }

  const responseHandler = entry.options?.responseHandler;
  if (responseHandler) {
    try {
      // The REST responseHandler signature expects a "list" | "create" | "read" | "update" method.
      // Map "delete" → "read" so handlers that branch on method receive a sane value.
      const restMethod = method === "delete" ? "read" : method;
      // Synthesize the minimal request shape responseHandlers commonly inspect.
      const syntheticReq = {params: {}, query: {}, user} as unknown as express.Request;
      return ensureApiId(await responseHandler(doc, restMethod, syntheticReq, entry.options));
    } catch (error) {
      logger.error(
        `[realtime] modelRouter responseHandler threw during realtime serialization for ` +
          `${entry.modelName}/${method}: ${error}. Dropping event to avoid leaking unsanitized data.`
      );
      throw error;
    }
  }

  return ensureApiId(typeof doc.toJSON === "function" ? doc.toJSON() : doc);
};

export const emitToAuthorizedRoom = async (
  io: Server,
  room: string,
  event: RealtimeEvent,
  entry: RealtimeRegistryEntry,
  fullDocument: any,
  logDebug: (msg: string) => void
): Promise<void> => {
  const sockets = getSocketsInRoom(io, room);
  for (const socket of sockets) {
    const user = getSocketUser(socket);
    // Hard deletes have no document context; use an empty object so object-scoped
    // permission helpers fail closed instead of treating the check as preflight.
    const permissionDocument = fullDocument ?? {};
    const canRead = await canReadDocument(entry, user, permissionDocument);
    if (!canRead) {
      logDebug(`[realtime] Skipped ${room} for ${socket.id}: read permission denied`);
      continue;
    }

    if (!fullDocument) {
      socket.emit("sync", event);
      continue;
    }

    const data = await serializeDoc(entry, fullDocument, event.method, user);
    socket.emit("sync", {...event, data});
  }
};

/**
 * Emit a sync event to document-specific and query rooms.
 *
 * Document rooms: `document:{collection}:{docId}` — clients subscribed to a single document.
 * Query rooms: `query:{queryId}` — clients subscribed to a query filter. The change stream
 * watcher evaluates whether the document matches each active query for the collection.
 *
 * For deletes, we are careful not to leak cross-user activity:
 *   - Soft deletes (fullDocument present) are matched against each query like updates so
 *     query subscribers only see deletes for docs that matched their filter.
 *   - Hard deletes (fullDocument absent) on owner-strategy collections are NOT forwarded
 *     to query rooms — subscribers will reconcile on their next fetch. Other strategies
 *     forward the delete because the model/broadcast rooms are not user-scoped.
 *
 * Exported for testing.
 */
export const emitToDocumentAndQueryRooms = async (
  io: Server,
  collection: string,
  event: RealtimeEvent,
  fullDocument: any,
  logDebug: (msg: string) => void,
  entry?: RealtimeRegistryEntry
): Promise<void> => {
  // Emit to document-specific room
  const docRoom = `document:${collection}:${event.id}`;
  if (entry) {
    await emitToAuthorizedRoom(io, docRoom, event, entry, fullDocument, logDebug);
  } else {
    io.to(docRoom).emit("sync", event);
  }
  logDebug(`[realtime] Emitted ${event.method} to ${docRoom}`);

  const isOwnerStrategy = entry?.config.roomStrategy === "owner";

  // Evaluate query subscriptions
  const querySubscriptions = getQuerySubscriptionsForCollection(collection);
  for (const {queryId, query} of querySubscriptions) {
    const queryRoom = `query:${queryId}`;

    if (event.method === "delete") {
      if (!fullDocument) {
        // Hard delete with no document context. For owner-strategy collections we can't
        // tell which query rooms belong to the owner without leaking activity to others,
        // so skip query fanout entirely — subscribers will reconcile on next fetch.
        if (isOwnerStrategy) {
          logDebug(
            `[realtime] Skipping hard delete fanout to ${queryRoom} (owner strategy, no fullDocument)`
          );
          continue;
        }
        if (entry) {
          await emitToAuthorizedRoom(io, queryRoom, event, entry, fullDocument, logDebug);
        } else {
          io.to(queryRoom).emit("sync", event);
        }
        logDebug(`[realtime] Emitted hard delete to ${queryRoom}`);
        continue;
      }

      // Soft delete: only forward to query rooms whose filter the document satisfies.
      if (matchesQuery(fullDocument, query)) {
        if (entry) {
          await emitToAuthorizedRoom(io, queryRoom, event, entry, fullDocument, logDebug);
        } else {
          io.to(queryRoom).emit("sync", event);
        }
        logDebug(`[realtime] Emitted soft delete to ${queryRoom} (query matched)`);
      }
      continue;
    }

    if (!fullDocument) {
      continue;
    }

    const docMatches = matchesQuery(fullDocument, query);

    if (event.method === "create" && docMatches) {
      // New document matches the query — send create event
      if (entry) {
        await emitToAuthorizedRoom(io, queryRoom, event, entry, fullDocument, logDebug);
      } else {
        io.to(queryRoom).emit("sync", event);
      }
      logDebug(`[realtime] Emitted create to ${queryRoom} (query matched)`);
    } else if (event.method === "update") {
      if (docMatches) {
        // Document still matches (or newly matches) — send update event
        if (entry) {
          await emitToAuthorizedRoom(io, queryRoom, event, entry, fullDocument, logDebug);
        } else {
          io.to(queryRoom).emit("sync", event);
        }
        logDebug(`[realtime] Emitted update to ${queryRoom} (query matched)`);
      } else {
        // Document no longer matches the query — send delete event so client removes it
        const removeEvent: RealtimeEvent = {
          ...event,
          method: "delete",
        };
        if (entry) {
          await emitToAuthorizedRoom(io, queryRoom, removeEvent, entry, fullDocument, logDebug);
        } else {
          io.to(queryRoom).emit("sync", removeEvent);
        }
        logDebug(`[realtime] Emitted delete to ${queryRoom} (query no longer matched)`);
      }
    }
  }
};

/**
 * Start watching MongoDB change streams and emitting real-time events.
 */
export const startChangeStreamWatcher = (
  io: Server,
  config: ChangeStreamConfig = {},
  debug = false
): void => {
  const logInfo = (message: string): void => {
    if (debug) {
      logger.info(message);
    }
  };

  const logDebug = (message: string): void => {
    if (debug) {
      logger.debug(message);
    }
  };

  try {
    logInfo("[realtime] Initializing change stream watcher...");

    const ignored = new Set([...DEFAULT_IGNORED_COLLECTIONS, ...(config.ignoredCollections ?? [])]);

    const ignoredOps = new Set(config.ignoredOperations ?? []);

    // Build the change stream pipeline
    const pipeline = [
      {
        $match: {
          "ns.coll": {$nin: Array.from(ignored)},
          operationType: {$in: ["insert", "update", "replace", "delete"]},
        },
      },
      {
        $project: {
          documentKey: 1,
          fullDocument: 1,
          ns: 1,
          operationType: 1,
          updateDescription: 1,
        },
      },
    ];

    const nativeDb = mongoose.connection.db;
    if (!nativeDb) {
      throw new Error("MongoDB connection not available for change stream");
    }

    const options: ChangeStreamOptions = {
      batchSize: config.batchSize ?? 50,
      fullDocument: config.fullDocument ?? "updateLookup",
      fullDocumentBeforeChange: "off",
      // How long the cursor waits for new events before yielding control.
      // Lower values give more responsive updates at the cost of more frequent driver round-trips.
      maxAwaitTimeMS: 1000,
    };

    changeWatcher = nativeDb.watch(pipeline, options);

    if (!changeWatcher) {
      throw new Error("Failed to create change stream watcher");
    }

    changeWatcher.on("change", async (rawChange: ChangeStreamDocument) => {
      try {
        // The pipeline restricts operationType to a subset that always has ns/documentKey;
        // narrow once here so downstream code doesn't need repeated casts.
        if (
          rawChange.operationType !== "insert" &&
          rawChange.operationType !== "update" &&
          rawChange.operationType !== "replace" &&
          rawChange.operationType !== "delete"
        ) {
          return;
        }
        const change = rawChange as WatchedChange;
        const collectionName = change.ns?.coll;
        const docId = change.documentKey?._id?.toString();

        if (!collectionName || !docId) {
          return;
        }

        // Check if this operation type is ignored
        if (ignoredOps.has(change.operationType)) {
          return;
        }

        // Find the registry entry for this collection
        const entry = findRegistryEntryByCollection(collectionName);

        if (!entry) {
          // Not a registered realtime model — skip
          logDebug(`[realtime] No registry entry for collection: ${collectionName}`);
          return;
        }

        // Map to our method type. Pass enabledMethods so soft deletes only
        // remap to "delete" when the model actually subscribes to deletes —
        // otherwise the change is kept as "update" so update subscribers
        // still receive it.
        const method = mapOperationType(change.operationType, change, entry.config.methods);
        if (!method) {
          return;
        }

        // Check if this method is enabled for this model
        if (!entry.config.methods.includes(method)) {
          logDebug(`[realtime] Method ${method} not enabled for ${entry.modelName}`);
          return;
        }

        // fullDocument is present on insert/update/replace; absent on delete.
        const fullDocument = change.operationType === "delete" ? undefined : change.fullDocument;

        // For hard deletes, we don't have the full document
        const isHardDelete = method === "delete" && !fullDocument;

        // Determine target rooms
        let rooms: string[];
        if (isHardDelete) {
          // Hard delete: no fullDocument, so we can't resolve owner/custom rooms.
          // For owner strategy we cannot safely fan out to a model room without
          // leaking deletes across users — admins still receive the event via the
          // admin room and any document-specific subscribers via document rooms.
          if (entry.config.roomStrategy === "owner") {
            rooms = ["admin"];
          } else if (entry.config.roomStrategy === "broadcast") {
            rooms = ["authenticated"];
          } else {
            const collectionTag = getCollectionTag(entry.routePath);
            rooms = [`model:${collectionTag}`];
          }
        } else {
          rooms = resolveRooms(entry, fullDocument, method);
        }

        const collection = getCollectionTag(entry.routePath);

        const event: RealtimeEvent = {
          collection,
          id: docId,
          method,
          model: entry.modelName,
          timestamp: DateTime.now().toMillis(),
          ...(change.operationType === "update" && change.updateDescription?.updatedFields
            ? {updatedFields: Object.keys(change.updateDescription.updatedFields)}
            : {}),
        };

        // Emit to strategy-based rooms (model/owner/broadcast)
        for (const room of rooms) {
          await emitToAuthorizedRoom(io, room, event, entry, fullDocument, logDebug);
        }

        // Emit to document-specific and query rooms
        await emitToDocumentAndQueryRooms(io, collection, event, fullDocument, logDebug, entry);

        logDebug(
          `[realtime] Emitted ${method} for ${entry.modelName}/${docId} to rooms: ${rooms.join(", ")}`
        );
        // Log only metadata — never the document payload, which may contain sensitive fields.
        const metadata: Record<string, unknown> = {
          collection: event.collection,
          id: event.id,
          method: event.method,
          model: event.model,
          timestamp: event.timestamp,
        };
        if (event.updatedFields) {
          metadata.updatedFields = event.updatedFields;
        }
        logInfo(`[realtime] sync event: ${JSON.stringify(metadata)}`);
      } catch (error) {
        logger.error(`[realtime] Error processing change event: ${error}`);
        Sentry.captureException(error);
      }
    });

    changeWatcher.on("error", (err: Error) => {
      Sentry.captureException(err);
      logger.error(`[realtime] Change stream error: ${err?.message || err}`);
    });

    changeWatcher.on("close", () => {
      logger.warn("[realtime] Change stream closed");
    });

    changeWatcher.on("end", () => {
      logger.warn("[realtime] Change stream ended");
    });

    logInfo("[realtime] Change stream watcher initialized successfully");
  } catch (error) {
    logger.error(`[realtime] Failed to initialize change stream watcher: ${error}`);
    Sentry.captureException(error);
    throw error;
  }
};

/**
 * Stop the change stream watcher.
 */
export const stopChangeStreamWatcher = async (): Promise<void> => {
  if (changeWatcher) {
    await changeWatcher.close();
    changeWatcher = null;
  }
};
