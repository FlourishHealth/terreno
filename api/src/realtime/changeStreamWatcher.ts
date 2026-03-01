import * as Sentry from "@sentry/bun";
import mongoose from "mongoose";
import type {Server} from "socket.io";

type ChangeStream = mongoose.mongo.ChangeStream;
type ChangeStreamDocument = mongoose.mongo.ChangeStreamDocument;
type ChangeStreamOptions = mongoose.mongo.ChangeStreamOptions;

import {logger} from "../logger";
import {findRegistryEntryByCollection, type RealtimeRegistryEntry} from "./registry";
import type {ChangeStreamConfig, RealtimeEvent} from "./types";

let changeWatcher: ChangeStream | null = null;

const DEFAULT_IGNORED_COLLECTIONS = ["socketio", "sessions"];

/**
 * Map MongoDB change stream operation types to our method names.
 */
const mapOperationType = (
  operationType: string,
  change: ChangeStreamDocument
): "create" | "update" | "delete" | null => {
  if (operationType === "insert") {
    return "create";
  }
  if (operationType === "update" || operationType === "replace") {
    // Check for soft delete (deleted: true)
    if (
      operationType === "update" &&
      (change as any).updateDescription?.updatedFields?.deleted === true
    ) {
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
 */
const resolveRooms = (entry: RealtimeRegistryEntry, doc: any, method: string): string[] => {
  const {roomStrategy} = entry.config;
  // Use the collection tag (e.g. "todos") for model rooms, matching what the frontend subscribes to
  const collectionTag = getCollectionTag(entry.routePath);

  if (typeof roomStrategy === "function") {
    // Custom room resolver — pass a minimal pseudo-request
    return roomStrategy(doc, method, {} as any);
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
 * Serialize a document for emission. Uses the realtime-specific handler if provided,
 * otherwise falls back to the modelRouter responseHandler via simple serialization.
 */
const serializeDoc = async (
  entry: RealtimeRegistryEntry,
  doc: any,
  method: string
): Promise<any> => {
  if (entry.config.realtimeResponseHandler) {
    return entry.config.realtimeResponseHandler(doc, method);
  }
  // Use toJSON for simple serialization since we don't have a request context in change streams
  return typeof doc.toJSON === "function" ? doc.toJSON() : doc;
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

    changeWatcher = nativeDb.watch(pipeline, options as any) as any;

    if (!changeWatcher) {
      throw new Error("Failed to create change stream watcher");
    }

    changeWatcher.on("change", async (change: ChangeStreamDocument) => {
      try {
        const collectionName = (change as any).ns?.coll;
        const docId = (change as any).documentKey?._id?.toString();

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

        // Map to our method type
        const method = mapOperationType(change.operationType, change);
        if (!method) {
          return;
        }

        // Check if this method is enabled for this model
        if (!entry.config.methods.includes(method)) {
          logDebug(`[realtime] Method ${method} not enabled for ${entry.modelName}`);
          return;
        }

        const fullDocument = (change as any).fullDocument;

        // For hard deletes, we don't have the full document
        const isHardDelete = method === "delete" && !fullDocument;

        // Determine target rooms
        let rooms: string[];
        if (isHardDelete) {
          // For hard deletes without a full doc, emit to model room
          const collectionTag = getCollectionTag(entry.routePath);
          rooms = [`model:${collectionTag}`];
        } else {
          rooms = resolveRooms(entry, fullDocument, method);
        }

        // Serialize the document
        let data: any;
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
          timestamp: Date.now(),
          ...(change.operationType === "update" && (change as any).updateDescription?.updatedFields
            ? {updatedFields: Object.keys((change as any).updateDescription.updatedFields)}
            : {}),
        };

        // Emit to each target room
        for (const room of rooms) {
          io.to(room).emit("sync", event);
        }

        logDebug(
          `[realtime] Emitted ${method} for ${entry.modelName}/${docId} to rooms: ${rooms.join(", ")}`
        );
      } catch (error) {
        logger.error(`[realtime] Error processing change event: ${error}`);
        Sentry.captureException(error);
      }
    });

    changeWatcher.on("error", (err: any) => {
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
