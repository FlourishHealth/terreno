import * as Sentry from "@sentry/bun";
import type express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import type {Server} from "socket.io";

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

import {logger} from "../logger";
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

/**
 * Determine which Socket.io rooms to emit to based on the room strategy.
 * Exported for testing.
 */
export const resolveRooms = (
  entry: RealtimeRegistryEntry,
  // biome-ignore lint/suspicious/noExplicitAny: doc shape varies per consumer model; resolver is at the framework boundary
  doc: any,
  method: string
): string[] => {
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
 * Failures in user-supplied handlers fall back to `toJSON()` (logged) so a serializer
 * bug never silently leaks a raw document or kills the change stream watcher.
 */
export const serializeDoc = async (
  entry: RealtimeRegistryEntry,
  // biome-ignore lint/suspicious/noExplicitAny: doc is a Mongoose document for an arbitrary consumer model
  doc: any,
  method: "create" | "update" | "delete"
  // biome-ignore lint/suspicious/noExplicitAny: serializer return shape is consumer-defined
): Promise<any> => {
  if (entry.config.realtimeResponseHandler) {
    try {
      return await entry.config.realtimeResponseHandler(doc, method);
    } catch (error) {
      logger.error(
        `[realtime] realtimeResponseHandler threw for ${entry.modelName}/${method}: ${error}. ` +
          "Falling back to toJSON."
      );
    }
  }

  const responseHandler = entry.options?.responseHandler;
  if (responseHandler) {
    try {
      // The REST responseHandler signature expects a "list" | "create" | "read" | "update" method.
      // Map "delete" → "read" so handlers that branch on method receive a sane value.
      const restMethod = method === "delete" ? "read" : method;
      // Synthesize the minimal request shape a sanitizing responseHandler is likely to read.
      // We intentionally do not pass a user — handlers must not depend on per-recipient context
      // for realtime serialization (events fan out to many rooms).
      const syntheticReq = {params: {}, query: {}, user: undefined} as unknown as express.Request;
      return await responseHandler(doc, restMethod, syntheticReq, entry.options);
    } catch (error) {
      logger.error(
        `[realtime] modelRouter responseHandler threw during realtime serialization for ` +
          `${entry.modelName}/${method}: ${error}. Falling back to toJSON.`
      );
    }
  }

  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
};

/**
 * Emit a sync event to document-specific and query rooms.
 *
 * Document rooms: `document:{collection}:{docId}` — clients subscribed to a single document.
 * Query rooms: `query:{queryId}` — clients subscribed to a query filter. The change stream
 * watcher evaluates whether the document matches each active query for the collection.
 * Exported for testing.
 */
export const emitToDocumentAndQueryRooms = (
  io: Server,
  collection: string,
  event: RealtimeEvent,
  // biome-ignore lint/suspicious/noExplicitAny: fullDocument shape varies per consumer model
  fullDocument: any,
  logDebug: (msg: string) => void
): void => {
  // Emit to document-specific room
  const docRoom = `document:${collection}:${event.id}`;
  io.to(docRoom).emit("sync", event);
  logDebug(`[realtime] Emitted ${event.method} to ${docRoom}`);

  // Evaluate query subscriptions
  const querySubscriptions = getQuerySubscriptionsForCollection(collection);
  for (const {queryId, query} of querySubscriptions) {
    const queryRoom = `query:${queryId}`;

    if (event.method === "delete") {
      // Always forward deletes — the client will remove the item if present
      io.to(queryRoom).emit("sync", event);
      logDebug(`[realtime] Emitted delete to ${queryRoom}`);
      continue;
    }

    if (!fullDocument) {
      continue;
    }

    const docMatches = matchesQuery(fullDocument, query);

    if (event.method === "create" && docMatches) {
      // New document matches the query — send create event
      io.to(queryRoom).emit("sync", event);
      logDebug(`[realtime] Emitted create to ${queryRoom} (query matched)`);
    } else if (event.method === "update") {
      if (docMatches) {
        // Document still matches (or newly matches) — send update event
        io.to(queryRoom).emit("sync", event);
        logDebug(`[realtime] Emitted update to ${queryRoom} (query matched)`);
      } else {
        // Document no longer matches the query — send delete event so client removes it
        const removeEvent: RealtimeEvent = {
          ...event,
          method: "delete",
        };
        io.to(queryRoom).emit("sync", removeEvent);
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

        // Serialize the document. Shape varies per consumer model, so the variable is unknown.
        let data: unknown;
        if (!isHardDelete && fullDocument) {
          data = await serializeDoc(entry, fullDocument, method);
        }

        const collection = getCollectionTag(entry.routePath);

        const event: RealtimeEvent = {
          collection,
          data,
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
          io.to(room).emit("sync", event);
        }

        // Emit to document-specific and query rooms
        emitToDocumentAndQueryRooms(io, collection, event, fullDocument, logDebug);

        logDebug(
          `[realtime] Emitted ${method} for ${entry.modelName}/${docId} to rooms: ${rooms.join(", ")}`
        );
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
