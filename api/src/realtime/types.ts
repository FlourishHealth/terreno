import type express from "express";
import type {UserModel} from "../auth";
import type {SyncAppOptions} from "../sync/routes";
import type {BetterAuthSocketOptions} from "./socketAuth";

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
    | ((doc: Record<string, unknown>, method: string, req: express.Request) => string[]);
  /** Custom serializer for real-time events. Falls back to the modelRouter responseHandler. */
  realtimeResponseHandler?: (doc: Record<string, unknown>, method: string) => unknown;
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
  // biome-ignore lint/suspicious/noExplicitAny: noExplicitAny: event data is a serialized document whose shape varies by model; consumers must narrow to their specific type
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
  /**
   * JWT issuer required for socket authentication (default: process.env.TOKEN_ISSUER),
   * for parity with the HTTP JWT path's `jwt.verify(token, secret, {issuer})` (D1).
   * Omit (and leave `TOKEN_ISSUER` unset) to skip the issuer check.
   */
  tokenIssuer?: string;
  /**
   * Enables the Better Auth session validator for socket authentication, tried after the
   * legacy JWT validator. Pass the instance returned by `createBetterAuth` (and optionally
   * the app user model so `decodedToken.id`/`admin` match the REST identity).
   */
  betterAuth?: BetterAuthSocketOptions;
  /**
   * Explicit SyncAppOptions override for the sync socket handlers. Normally omitted —
   * the options registered by the SyncApp plugin are used automatically.
   */
  sync?: SyncAppOptions;
  /**
   * The application's Mongoose user model. When provided, the full user document is
   * loaded once at handshake (by the decoded token's id) and cached on
   * `socket.data.fullUser`, then refreshed by the periodic session re-validation sweep
   * (D1). Authorization for realtime/sync subscriptions and mutations uses this full
   * document instead of the synthetic `{_id, admin, id}` shape derived from the token
   * alone — required for any permission check or `getUserScopes` resolver that reads
   * fields beyond `admin` (e.g. `organizationIds` for tenant-scoped sync). Without it,
   * socket-side authorization falls back to the synthetic shape (pre-D2 behavior).
   */
  userModel?: UserModel;
  /**
   * Interval in ms for the periodic socket session re-validation sweep (D1): re-checks
   * JWT expiry / Better Auth session validity and the user's `disabled` flag for every
   * connected socket, disconnecting (`sync:auth-expired` then `disconnect(true)`) any
   * socket that fails. Also refreshes `socket.data.fullUser` (D2) and re-resolves sync
   * stream membership, leaving rooms for streams no longer held (D4). Default 60_000ms;
   * set to 0 to disable the sweep entirely (e.g. in tests).
   */
  sessionRevalidationIntervalMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Payload sent by the client to subscribe to a single document's changes.
 */
export interface DocumentSubscription {
  /** Collection tag (e.g. "todos") */
  collection: string;
  /** Document ID */
  id: string;
}

/**
 * Payload sent by the client to subscribe to a query-filtered list.
 */
export interface QuerySubscription {
  /** Collection tag (e.g. "todos") */
  collection: string;
  /** MongoDB-style query filter (e.g. {completed: false}) */
  query: Record<string, unknown>;
  /** Client-provided queryId (ignored — server computes a canonical ID) */
  queryId?: string;
}
