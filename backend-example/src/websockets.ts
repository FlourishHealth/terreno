// biome-ignore-all lint/suspicious/noExplicitAny: Some types in this file require suppression due to dynamic data structures or external library types that do not provide complete typings.
import {createServer} from "node:http";
import * as Sentry from "@sentry/node";
import {createAdapter} from "@socket.io/mongo-adapter";
import {createAdapter as createRedisAdapter} from "@socket.io/redis-adapter";
import {authorize} from "@thream/socketio-jwt";
import type express from "express";
import {APIError, logger} from "@terreno/api";
import Redis from "ioredis";
import type {
	ChangeStream,
	ChangeStreamDocument,
	ChangeStreamInsertDocument,
	ChangeStreamOptions,
} from "mongodb";
import mongoose from "mongoose";
import {Server} from "socket.io";
import {isProduction, isPullRequest, isStaging, isWebsocketService, WEBSOCKETS_DEBUG} from "./conf";

// Use different port for websockets when running standalone vs when part of 'all' services
const port = process.env.WEBSOCKET_PORT || process.env.PORT || "9000";
const MONGO_SOCKET_COLLECTION = "socketio";

export let io: Server | null = null;
export let websocketHttpServer: any = null;
let websocketProcessingEnabled = true;
let redisClients: {pub: Redis; sub: Redis} | null = null;

export const setWebsocketProcessingEnabled = (enabled: boolean): void => {
	websocketProcessingEnabled = enabled;
};

interface FormInstancePresenceData {
	formInstanceId: string;
	userId: string;
	questionId: string;
	presence: "focus" | "blur";
}

let changeWatcher: ChangeStream | null = null;

const logWebsocketInfo = (message: string): void => {
	if (WEBSOCKETS_DEBUG) {
		logger.info(message);
	}
};

const logWebsocketDebug = (message: string): void => {
	if (WEBSOCKETS_DEBUG) {
		logger.debug(message);
	}
};

const watchModels = (): void => {
	try {
		logWebsocketInfo("[websocket] Initializing model watcher...");

		const ignored = new Set([
			"FitbitHeartRate",
			"FitbitHrv",
			"FitbitIntradaySteps",
			"FitbitSleep",
			"auditlogevents",
			MONGO_SOCKET_COLLECTION,
		]);
		logWebsocketInfo(`[websocket] Ignoring collections: ${Array.from(ignored).join(", ")}`);

		// Change stream pipeline: only events we actually care about
		const pipeline = [
			{
				$match: {
					// exclude noisy/ignored collections
					"ns.coll": {$nin: Array.from(ignored)},
					// only these operations matter
					operationType: {$in: ["insert", "update", "replace", "delete"]},
				},
			},
			// project just the fields we use to shrink payloads
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

		// Prefer secondary for change streams to take read pressure off primary
		const nativeDb = mongoose.connection.db;
		const options: ChangeStreamOptions = {
			batchSize: 50, // Smaller batches to reduce memory pressure
			fullDocument: "updateLookup", // Only include full document for updates
			fullDocumentBeforeChange: "off", // Don't include before change docs
			maxAwaitTimeMS: 1000, // More frequent processing
			readPreference: "secondaryPreferred",
		};

		if (!nativeDb) {
			const error = new Error("Native database is not connected");
			logger.error(`[websocket] ${error.message}`);
			throw error;
		}

		logWebsocketInfo("[websocket] Creating change stream watcher...");
		changeWatcher = nativeDb.watch(pipeline, options);

		changeWatcher.on("change", async (change: ChangeStreamDocument) => {
			try {
				await emitter(change);
			} catch (error) {
				logger.error(`[websocket] Error processing change event: ${error}`);
				Sentry.captureException(error);
			}
		});

		changeWatcher.on("error", (err: any) => {
			Sentry.captureException(err);
			logger.error(`[websocket] Change stream error: ${err?.message || err}`);
			// optional: exponential backoff restart here
		});

		changeWatcher.on("close", () => {
			logger.warn("[websocket] Change stream closed");
		});

		changeWatcher.on("end", () => {
			logger.warn("[websocket] Change stream ended");
		});

		logWebsocketInfo("[websocket] Model watcher initialized successfully");
		logWebsocketDebug("[websocket] Watching database-level change stream with filter pipeline");
	} catch (error) {
		logger.error(`[websocket] Failed to initialize model watcher: ${error}`);
		Sentry.captureException(error);
		throw error;
	}
};

// Export cleanup function to be called by main graceful shutdown
export const closeWebsockets = async (): Promise<void> => {
	try {
		if (websocketHttpServer) {
			await websocketHttpServer.close();
			websocketHttpServer = null;
		}
		if (changeWatcher) {
			await changeWatcher.close();
			changeWatcher = null;
		}
		if (io) {
			await io.close();
			io = null;
		}
		if (redisClients) {
			await redisClients.pub.quit();
			await redisClients.sub.quit();
			redisClients = null;
		}
	} catch (error) {
		logger.error(`Error closing websockets: ${error}`);
	}
};

// If we're not one of the websockets services, we will connect and set up the mongo adapter so we
// can emit to websockets.
// If we are one of the websockets services, we will watch models and emit to websockets.
export const connectToWebsockets = async (app: express.Application): Promise<void> => {
	try {
		logWebsocketInfo("[websocket] Starting websocket connection setup...");
		logWebsocketInfo(
			`[websocket] Service configuration - FLOURISH_SERVICE: ${process.env.FLOURISH_SERVICE}`
		);
		logWebsocketInfo(`[websocket] Service flags - isWebsocketService: ${isWebsocketService}`);

		if (io) {
			throw new Error("WebSocket server is already initialized");
		}

		websocketHttpServer = createServer(app);
		if (!websocketHttpServer) {
			throw new Error("WebSocket server is not initialized");
		}
		io = new Server(websocketHttpServer, {
			cors: {
				methods: ["GET", "POST"],
				origin: "*",
			},
		});
		logWebsocketInfo("[websocket] Socket.io server created successfully");

		io.use(
			authorize({
				secret: process.env.TOKEN_SECRET as string,
			})
		);
		logWebsocketInfo("[websocket] JWT authorization middleware added");

		// Configure adapter based on deployment environment
		if ((isProduction || isStaging) && !isPullRequest) {
			// Use Redis/Valkey adapter in production
			const redisUrl = process.env.VALKEY_URL || "redis://localhost:6379";
			logWebsocketInfo(`[websocket] Using Redis adapter with URL: ${redisUrl}`);

			try {
				const pubClient = new Redis(redisUrl);
				const subClient = pubClient.duplicate();

				// Store clients for cleanup
				redisClients = {pub: pubClient, sub: subClient};

				// Test Redis connection
				await pubClient.ping();
				logWebsocketInfo("[websocket] Redis connection established successfully");

				io.adapter(createRedisAdapter(pubClient, subClient));
				logWebsocketInfo("[websocket] Redis adapter configured successfully");
			} catch (error) {
				logger.error(`[websocket] Failed to connect to Redis: ${error}`);
				Sentry.captureException(error);
				throw new APIError({
					status: 500,
					title: `Cannot connect to Redis for websockets: ${error}`,
				});
			}
		} else {
			// Use MongoDB adapter in development
			logWebsocketInfo("[websocket] Using MongoDB adapter for development");

			try {
				// Fetch the socket collection to pass to socket.io
				const mongoCollection = mongoose.connection.collection(MONGO_SOCKET_COLLECTION);

				// Create a TTL index on the createdAt field to automatically delete old socketio documents
				// after 1 hour.
				await mongoCollection.createIndex(
					{createdAt: 1},
					{background: true, expireAfterSeconds: 3600}
				);

				// Additional performance indexes for socket.io adapter
				await mongoCollection.createIndex({sid: 1}, {background: true});
				await mongoCollection.createIndex({rooms: 1}, {background: true});

				// Use socket.io's mongo adapter to let multiple backend instances talk to all users
				// connected to any single instance, otherwise we can only talk to users connected to the
				// same instance.
				io.adapter(
					createAdapter(mongoCollection as any, {
						addCreatedAtField: true,
					}) as any
				);
				logWebsocketInfo("[websocket] MongoDB adapter configured successfully");
			} catch (error) {
				logger.error(`[websocket] Failed to configure MongoDB adapter: ${error}`);
				Sentry.captureException(error);
				throw new APIError({
					status: 500,
					title: `Cannot configure MongoDB adapter for websockets: ${error}`,
				});
			}
		}

		io.on("connect_error", (error: Error) => {
			logger.error(`[websocket] Connection error: ${error.message}`);
			Sentry.captureException(error);
			throw new APIError({
				status: 400,
				title: `Cannot connect to websockets server-side due to ${error.message}`,
			});
		});

		// Add users to rooms so we can broadcast messages.
		io.on("connection", async (socket: any): Promise<void> => {
			try {
				// Staff join a staff room so we can emit to all staff users across all backend instances.
				if (socket.decodedToken.type === "Staff") {
					await socket.join("staff");
				}
				// Users join their own room so we can emit to them individually.
				await socket.join(socket.decodedToken.id);
				logger.debug(`[websocket] User joined: ${socket.decodedToken.id}`);

				// When a user joins a form instance, join their room for that form instance.
				socket.on("formInstance-join", async (data: FormInstancePresenceData) => {
					logger.debug(
						`[websocket] User ${socket.decodedToken.id} joined form instance ${data.formInstanceId}`
					);
					await socket.join(`formInstance-${data.formInstanceId}`);
				});

				// When a user leaves a form instance, leave their room for that form instance.
				socket.on("formInstance-leave", async (data: FormInstancePresenceData) => {
					logger.debug(
						`[websocket] User ${socket.decodedToken.id} left form instance ${data.formInstanceId}`
					);
					await socket.leave(`formInstance-${data.formInstanceId}`);
				});

				// Send blur and focus events to the form instance room.
				socket.on("formInstance-presence", async (data: FormInstancePresenceData) => {
					logger.debug(
						`[websocket] User ${socket.decodedToken.id} presence change for form instance ${data.formInstanceId}`
					);
					// Ensure the user is in the room before emitting.
					await socket.join(`formInstance-${data.formInstanceId}`);
					socket.to(`formInstance-${data.formInstanceId}`).emit("formInstance-presence", data);
				});
			} catch (error) {
				logger.error(`[websocket] Error handling user connection: ${error}`);
				Sentry.captureException(error);
			}
		});

		// Determine what to do based on service configuration
		logWebsocketInfo("[websocket] Checking service configuration for next steps...");

		if (isWebsocketService) {
			logWebsocketInfo(`[websocket] Starting websocket service on port ${port}`);
			try {
				// Only start listening when running as standalone websocket service
				websocketHttpServer.listen(port, () => {
					logWebsocketInfo(`[websocket] HTTP server successfully listening on port ${port}`);
				});

				// Add error handling for server startup
				websocketHttpServer.on("error", (error: unknown) => {
					logger.error(`[websocket] HTTP server error: ${error}`);
					Sentry.captureException(error);
					throw new APIError({
						status: 500,
						title: `Failed to start websocket server: ${(error as Error).message}`,
					});
				});
			} catch (error) {
				logger.error(`[websocket] Failed to start HTTP server on port ${port}: ${error}`);
				Sentry.captureException(error);
				throw error;
			}
		} else {
			logWebsocketInfo("[websocket] Not starting HTTP server (not a websocket service)");
		}

		if (isWebsocketService) {
			logWebsocketInfo("[websocket] Starting model watcher for websocket-only service");
			try {
				watchModels();
				logWebsocketInfo("[websocket] Model watcher started successfully");
			} catch (error) {
				logger.error(`[websocket] Failed to start model watcher: ${error}`);
				Sentry.captureException(error);
				throw error;
			}
		} else {
			logWebsocketInfo("[websocket] Not starting model watcher (not a websocket-only service)");
		}

		logWebsocketInfo("[websocket] Websocket connection setup completed successfully");
	} catch (error) {
		logger.error(`[websocket] Failed to connect to websockets: ${error}`);
		Sentry.captureException(error);
		throw error;
	}
};

export const getIoInstance = (): Server => {
	if (!io) {
		throw new Error("Socket.io instance is not initialized");
	}
	return io;
};

export const emitToRoom = (eventName: string, room: string, data: Record<string, any>): void => {
	try {
		io?.to(room).emit(eventName, data);
	} catch (error) {
		Sentry.captureException(
			`Error emitting event ${eventName} to room ${room} due to error: ${error}`
		);
		logger.error(`Error emitting event ${eventName} to room ${room} due to error: ${error}`);
	}
};

export const emitToUser = (eventName: string, userId: string, data: any): void => {
	// Skip membership check; just emit to the room.
	// If the room is empty, adapter drops it—no harm done.
	try {
		io?.to(userId).emit(eventName, data);
	} catch (error) {
		Sentry.captureException(
			`Error emitting event ${eventName} for user ${userId} due to error: ${error}`
		);
		logger.error(`Error emitting event ${eventName} for user ${userId} due to error: ${error}`);
	}
};

const emitter = async (change: ChangeStreamDocument): Promise<void> => {
	// Early memory cleanup - remove large objects we don't need
	if ((change as ChangeStreamInsertDocument).fullDocument && change.operationType !== "insert") {
		delete (change as any).fullDocument;
	}

	if (WEBSOCKETS_DEBUG) {
		const coll = (change as any).ns?.coll;
		const id = (change as any).documentKey?._id?.toString();
		const changeDescription = JSON.stringify((change as any).updateDescription);
		logWebsocketDebug(`[websocket] ${coll}/${id} change: ${changeDescription}`);
	}

	// we never want to disable websockets in production.
	// This is mainly just for when we load test data as it causes errors/lots of noise if we allow
	// websockets while that script is running
	if (process.env.NODE_ENV !== "production" && !websocketProcessingEnabled) {
		return;
	}

	if (
		change.operationType === "update" &&
		change.updateDescription?.updatedFields?.deleted === true
	) {
		io?.emit("changeEvent", {
			_id: change.documentKey?._id,
			collection: change.ns.coll,
			type: "delete",
		});
	} else {
		io?.emit("changeEvent", {
			_id: (change as any).documentKey?._id,
			collection: (change as any).ns.coll,
			type: change.operationType,
		});
	}
};

type EventDataMapping = {
	notificationEvent: {conversationId?: string; sound: string};
	invalidateTagEvent: {collection: string};
	messageNotificationEvent: {
		conversationId: string;
		messageId: string;
		notificationId: string;
	};
	messageTranslationEvent: {
		messageId: string;
		translationText: string;
	};
	conversationReadEvent: {
		conversationId: string;
		lastReadDateTime: string;
		unreadCount: number;
		tagCount: number;
	};
};
type EventData<T extends keyof EventDataMapping> = EventDataMapping[T];

export const emitEvent = <T extends keyof EventDataMapping>(
	eventName: T,
	userId: string,
	data: EventData<T>
): void => {
	void emitToUser(eventName, userId, data);

	io?.sockets.sockets.forEach((socket: any) => {
		if (socket.decodedToken.id === userId) {
			try {
				socket.emit(`${eventName}${userId}`, data);
			} catch (error) {
				Sentry.captureException(
					`Error emitting event ${eventName} for user ${userId} due to error: ${error}`
				);
				logger.error(`Error emitting event ${eventName} for user ${userId} due to error: ${error}`);
			}
		}
	});
};
