import type http from "node:http";
import * as Sentry from "@sentry/bun";
import {authorize} from "@thream/socketio-jwt";
import type express from "express";
import {Server} from "socket.io";

import {logger} from "../logger";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {startChangeStreamWatcher, stopChangeStreamWatcher} from "./changeStreamWatcher";
import type {RealtimeAppOptions} from "./types";

/**
 * TerrenoPlugin that provides real-time sync via Socket.io and MongoDB change streams.
 *
 * Attaches a Socket.io server to the HTTP server created by TerrenoApp.start(),
 * sets up JWT authentication for socket connections, manages room subscriptions,
 * and starts a change stream watcher that emits events to connected clients.
 *
 * @example
 * ```typescript
 * const app = new TerrenoApp({ userModel: User })
 *   .register(todoRouter)   // todoRouter has realtime config
 *   .register(new RealtimeApp({
 *     changeStream: {
 *       ignoredCollections: ['sessions'],
 *     },
 *   }))
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
      this.io.on("connection", async (socket: any): Promise<void> => {
        try {
          const userId = socket.decodedToken?.id;
          const isAdmin = socket.decodedToken?.admin === true;

          if (userId) {
            // Join user-specific room
            await socket.join(`user:${userId}`);
            // Join the general authenticated room
            await socket.join("authenticated");
            logInfo(`[realtime] User ${userId} connected`);
          }

          if (isAdmin) {
            await socket.join("admin");
            logInfo(`[realtime] Admin user ${userId} joined admin room`);
          }

          // Model room subscription
          socket.on("subscribe:model", async (modelName: string): Promise<void> => {
            if (typeof modelName === "string" && modelName.length > 0) {
              await socket.join(`model:${modelName}`);
              logInfo(`[realtime] User ${userId} subscribed to model:${modelName}`);
            }
          });

          socket.on("unsubscribe:model", async (modelName: string): Promise<void> => {
            if (typeof modelName === "string" && modelName.length > 0) {
              await socket.leave(`model:${modelName}`);
              logInfo(`[realtime] User ${userId} unsubscribed from model:${modelName}`);
            }
          });

          socket.on("disconnect", () => {
            logInfo(`[realtime] User ${userId} disconnected`);
          });
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
