import type http from "node:http";
import * as Sentry from "@sentry/bun";
import {authorize} from "@thream/socketio-jwt";
import type express from "express";
import {Server} from "socket.io";

import {logger} from "../logger";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {startChangeStreamWatcher, stopChangeStreamWatcher} from "./changeStreamWatcher";
import {
  addQuerySubscription,
  computeQueryId,
  removeAllSocketQueries,
  removeQuerySubscription,
} from "./queryStore";
import {findRegistryEntryByRoutePath} from "./registry";
import type {DocumentSubscription, QuerySubscription, RealtimeAppOptions} from "./types";

/**
 * Caps on per-socket subscriptions. Prevents a malicious or buggy client from
 * exhausting server memory by opening unbounded subscriptions.
 */
export const MAX_MODEL_SUBSCRIPTIONS = 50;
export const MAX_DOCUMENT_SUBSCRIPTIONS = 500;
export const MAX_QUERY_SUBSCRIPTIONS = 100;

/**
 * Minimal shape this module requires from a Socket.io socket. Lets tests pass a
 * mock without standing up a real server.
 */
export interface RealtimeSocketLike {
  id: string;
  decodedToken?: {id?: string; admin?: boolean};
  join: (room: string) => Promise<void> | void;
  leave: (room: string) => Promise<void> | void;
  emit: (event: string, payload: unknown) => void;
  on: (event: string, handler: (...args: any[]) => any) => void;
}

/**
 * Install the realtime subscription handlers on a single socket. Extracted from the
 * RealtimeApp connection handler so this logic can be unit-tested with a mock socket
 * (no real Socket.io / HTTP server / JWT handshake required).
 *
 * Enforces:
 *   - per-socket subscription caps (DoS protection)
 *   - registry membership (only realtime-enabled collections can be subscribed)
 *   - owner-strategy isolation (non-admin users cannot subscribe to other users' rooms)
 *   - server-side queryId computation (clients can't hijack queries by colliding ids)
 */
export const installRealtimeSocketHandlers = (
  socket: RealtimeSocketLike,
  options: {logInfo?: (msg: string) => void} = {}
): void => {
  const logInfo = options.logInfo ?? ((): void => {});
  const userId = socket.decodedToken?.id;
  const isAdmin = socket.decodedToken?.admin === true;

  const counts = {document: 0, model: 0, query: 0};

  const joinUserRooms = async (): Promise<void> => {
    if (userId) {
      await socket.join(`user:${userId}`);
      await socket.join("authenticated");
      logInfo(`[realtime] User ${userId} connected`);
    }
    if (isAdmin) {
      await socket.join("admin");
      logInfo(`[realtime] Admin user ${userId} joined admin room`);
    }
  };

  // Fire-and-forget — there is nothing useful for the caller to await.
  void joinUserRooms();

  socket.on("subscribe:model", async (modelName: string): Promise<void> => {
    if (typeof modelName !== "string" || modelName.length === 0) {
      return;
    }
    if (counts.model >= MAX_MODEL_SUBSCRIPTIONS) {
      logInfo(`[realtime] User ${userId} hit model subscription limit`);
      return;
    }

    const entry = findRegistryEntryByRoutePath(modelName);
    if (!entry) {
      logInfo(
        `[realtime] User ${userId} denied model subscription: collection "${modelName}" not registered`
      );
      return;
    }

    // Owner-strategy models fan out via user:{ownerId} — there is no shared model room
    // that should be open to all users. Owners receive events through their user room
    // automatically; admins can use the admin room to see everything.
    if (entry.config.roomStrategy === "owner" && !isAdmin) {
      logInfo(
        `[realtime] User ${userId} denied model subscription for ${modelName}: ` +
          "owner strategy restricts model room to admins"
      );
      return;
    }

    counts.model += 1;
    await socket.join(`model:${modelName}`);
    logInfo(`[realtime] User ${userId} subscribed to model:${modelName}`);
  });

  socket.on("unsubscribe:model", async (modelName: string): Promise<void> => {
    if (typeof modelName === "string" && modelName.length > 0) {
      await socket.leave(`model:${modelName}`);
      counts.model = Math.max(0, counts.model - 1);
      logInfo(`[realtime] User ${userId} unsubscribed from model:${modelName}`);
    }
  });

  socket.on("subscribe:document", async (payload: DocumentSubscription): Promise<void> => {
    if (
      !payload?.collection ||
      !payload?.id ||
      typeof payload.collection !== "string" ||
      typeof payload.id !== "string"
    ) {
      return;
    }
    if (counts.document >= MAX_DOCUMENT_SUBSCRIPTIONS) {
      logInfo(`[realtime] User ${userId} hit document subscription limit`);
      return;
    }

    const entry = findRegistryEntryByRoutePath(payload.collection);
    if (!entry) {
      logInfo(
        `[realtime] User ${userId} denied document subscription: ` +
          `collection "${payload.collection}" not registered`
      );
      return;
    }

    if (entry.config.roomStrategy === "owner" && !isAdmin) {
      logInfo(
        `[realtime] User ${userId} denied document subscription for ` +
          `${payload.collection}/${payload.id}: owner strategy requires admin`
      );
      return;
    }

    counts.document += 1;
    const room = `document:${payload.collection}:${payload.id}`;
    await socket.join(room);
    logInfo(`[realtime] User ${userId} subscribed to ${room}`);
  });

  socket.on("unsubscribe:document", async (payload: DocumentSubscription): Promise<void> => {
    if (payload?.collection && payload?.id) {
      const room = `document:${payload.collection}:${payload.id}`;
      await socket.leave(room);
      counts.document = Math.max(0, counts.document - 1);
      logInfo(`[realtime] User ${userId} unsubscribed from ${room}`);
    }
  });

  socket.on("subscribe:query", async (payload: QuerySubscription): Promise<void> => {
    if (
      !payload?.collection ||
      !payload?.query ||
      typeof payload.collection !== "string" ||
      typeof payload.query !== "object" ||
      Array.isArray(payload.query)
    ) {
      return;
    }
    if (counts.query >= MAX_QUERY_SUBSCRIPTIONS) {
      logInfo(`[realtime] User ${userId} hit query subscription limit`);
      return;
    }

    const entry = findRegistryEntryByRoutePath(payload.collection);
    if (!entry) {
      logInfo(
        `[realtime] User ${userId} denied query subscription: ` +
          `collection "${payload.collection}" not registered`
      );
      return;
    }

    let query = {...payload.query};
    if (entry.config.roomStrategy === "owner" && !isAdmin) {
      if (!userId) {
        return;
      }
      query = {...query, ownerId: userId};
    }

    const queryId = computeQueryId(payload.collection, query);

    addQuerySubscription(socket.id, payload.collection, query, queryId);
    counts.query += 1;
    await socket.join(`query:${queryId}`);
    socket.emit("query:subscribed", {collection: payload.collection, queryId});
    logInfo(`[realtime] User ${userId} subscribed to query:${queryId} on ${payload.collection}`);
  });

  socket.on("unsubscribe:query", async (payload: {queryId: string}): Promise<void> => {
    if (payload?.queryId) {
      removeQuerySubscription(socket.id, payload.queryId);
      await socket.leave(`query:${payload.queryId}`);
      counts.query = Math.max(0, counts.query - 1);
      logInfo(`[realtime] User ${userId} unsubscribed from query:${payload.queryId}`);
    }
  });

  socket.on("disconnect", () => {
    removeAllSocketQueries(socket.id);
    logInfo(`[realtime] User ${userId} disconnected`);
  });
};

/**
 * TerrenoPlugin that provides real-time sync via Socket.io and MongoDB change streams.
 *
 * Attaches a Socket.io server to the HTTP server created by TerrenoApp.start(),
 * sets up JWT authentication for socket connections, manages room subscriptions
 * (model, document, and query rooms), and starts a change stream watcher that
 * emits events to connected clients.
 *
 * ## Subscription types
 *
 * - **Model rooms**: `subscribe:model` / `unsubscribe:model` — receive all events for a collection
 * - **Document rooms**: `subscribe:document` / `unsubscribe:document` — receive events for a single document
 * - **Query rooms**: `subscribe:query` / `unsubscribe:query` — receive events matching a MongoDB query
 *
 * @example
 * ```typescript
 * const app = new TerrenoApp({
 *   userModel: User,
 *   realtime: { debug: true },
 * })
 *   .register(todoRouter)   // todoRouter has realtime config
 *   .start();
 * ```
 */
export class RealtimeApp implements TerrenoPlugin {
  private io: Server | null = null;
  private config: RealtimeAppOptions;

  constructor(config: RealtimeAppOptions = {}) {
    this.config = config;
  }

  /**
   * Register routes and middleware. Adds a /realtime/health endpoint.
   */
  register(app: express.Application): void {
    app.get("/realtime/health", (_req, res) => {
      const connected = this.io?.engine?.clientsCount ?? 0;
      res.json({
        clients: connected,
        status: this.io ? "running" : "not_started",
      });
    });
  }

  /**
   * Called after the HTTP server is created. Sets up Socket.io, auth, rooms,
   * and starts the change stream watcher.
   */
  onServerCreated(server: http.Server): void {
    const debug = this.config.debug ?? false;

    const logInfo = (message: string): void => {
      if (debug) {
        logger.info(message);
      }
    };

    try {
      logInfo("[realtime] Setting up Socket.io server...");

      this.io = new Server(server, {
        cors: this.config.cors ?? {
          methods: ["GET", "POST"],
          origin: "*",
        },
      });

      // JWT authentication middleware
      const tokenSecret = this.config.tokenSecret ?? process.env.TOKEN_SECRET;
      if (!tokenSecret) {
        throw new Error(
          "[realtime] TOKEN_SECRET is required for socket authentication. " +
            "Set process.env.TOKEN_SECRET or pass tokenSecret in RealtimeAppOptions."
        );
      }

      this.io.use(
        authorize({
          secret: tokenSecret,
        })
      );

      logInfo("[realtime] JWT authorization middleware added");

      // Configure adapter for multi-instance deployments
      this.setupAdapter(logInfo);

      // Connection handling
      this.io.on("connection", (socket: any): void => {
        try {
          installRealtimeSocketHandlers(socket, {logInfo});
        } catch (error) {
          logger.error(`[realtime] Error handling connection: ${error}`);
          Sentry.captureException(error);
        }
      });

      this.io.on("connect_error", (error: Error) => {
        logger.error(`[realtime] Connection error: ${error.message}`);
        Sentry.captureException(error);
      });

      // Start the change stream watcher
      startChangeStreamWatcher(this.io, this.config.changeStream, debug);

      logInfo("[realtime] Socket.io server setup complete");
    } catch (error) {
      logger.error(`[realtime] Failed to set up Socket.io: ${error}`);
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Get the Socket.io server instance.
   */
  getIo(): Server | null {
    return this.io;
  }

  /**
   * Gracefully shut down the real-time server.
   */
  async close(): Promise<void> {
    try {
      await stopChangeStreamWatcher();
      if (this.io) {
        await this.io.close();
        this.io = null;
      }
    } catch (error) {
      logger.error(`[realtime] Error closing: ${error}`);
    }
  }

  private setupAdapter(logInfo: (msg: string) => void): void {
    if (!this.io) {
      return;
    }

    const adapter = this.config.adapter ?? "none";

    if (adapter === "redis") {
      const redisUrl = this.config.redisUrl ?? process.env.VALKEY_URL ?? process.env.REDIS_URL;
      if (redisUrl) {
        logInfo(`[realtime] Redis adapter configured with URL: ${redisUrl}`);
        // Redis adapter must be configured externally by the consuming app
        // since @socket.io/redis-adapter and ioredis are optional peer dependencies.
        // Use realtimeApp.getIo() to access the Socket.io instance and call
        // io.adapter(createRedisAdapter(pubClient, subClient))
        logger.info(
          "[realtime] To enable Redis adapter, configure it after server creation via getIo(). " +
            "See @socket.io/redis-adapter docs."
        );
      } else {
        logger.warn("[realtime] Redis adapter requested but no VALKEY_URL or REDIS_URL found");
      }
    }
    // 'none' — no adapter, single instance mode
  }
}
