import type express from "express";

/**
 * Configuration for real-time sync on a modelRouter.
 * Determines which CRUD methods emit WebSocket events and how they are routed.
 */
export interface RealtimeConfig {
  /** Which CRUD methods should emit real-time sync events */
  methods: Array<"create" | "update" | "delete">;
  /**
   * Strategy for determining which Socket.io rooms receive events.
   * - 'owner': emit to `user:{doc.ownerId}` room
   * - 'model': emit to `model:{modelName}` room (clients must subscribe)
   * - 'broadcast': emit to all authenticated sockets
   * - function: custom room resolver returning room name(s)
   */
  roomStrategy:
    | "owner"
    | "model"
    | "broadcast"
    | ((doc: any, method: string, req: express.Request) => string[]);
  /** Custom serializer for real-time events. Falls back to the modelRouter responseHandler. */
  realtimeResponseHandler?: (doc: any, method: string) => any;
}

/**
 * A real-time sync event emitted to clients via WebSocket.
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
  /** Fields that were updated (for update events from change streams) */
  updatedFields?: string[];
  /** Epoch milliseconds when the event was generated */
  timestamp: number;
}

/**
 * Configuration for the MongoDB change stream watcher.
 */
export interface ChangeStreamConfig {
  /** Collections to never watch (e.g. "socketio", "sessions") */
  ignoredCollections?: string[];
  /** Operation types to ignore */
  ignoredOperations?: string[];
  /** Non-modelRouter collections to watch (emits raw events) */
  additionalCollections?: string[];
  /** Change stream batch size (default: 50) */
  batchSize?: number;
  /** Full document mode (default: "updateLookup") */
  fullDocument?: "updateLookup" | "whenAvailable";
}

/**
 * Options for the RealtimeApp plugin.
 */
export interface RealtimeAppOptions {
  /** Change stream watcher configuration */
  changeStream?: ChangeStreamConfig;
  /** CORS configuration for Socket.io */
  cors?: {origin: string | string[]; methods?: string[]};
  /**
   * Socket.io adapter for multi-instance deployments.
   * - 'none': single-instance mode, no adapter (default)
   * - 'redis': use Redis adapter (requires redisUrl or VALKEY_URL env var)
   *
   * For MongoDB adapter or custom adapters, configure the Socket.io instance
   * directly via getIo() after server creation.
   */
  adapter?: "redis" | "none";
  /** Redis URL for the Redis adapter */
  redisUrl?: string;
  /** JWT secret for socket authentication (default: process.env.TOKEN_SECRET) */
  tokenSecret?: string;
  /** Enable debug logging */
  debug?: boolean;
}
