import {LoggingWinston} from "@google-cloud/logging-winston";
import * as Sentry from "@sentry/node";
import {
  checkModelsStrict,
  logger,
  modelRouter,
  OwnerQueryFilter,
  Permissions,
  TerrenoApp,
} from "@terreno/api";
import mongoose from "mongoose";
import {isDeployed} from "./conf";
import {Todo} from "./models";
import {Configuration} from "./models/configuration";
import {User} from "./models/user";
import type {TodoDocument, UserDocument} from "./types";
import {connectToMongoDB} from "./utils/database";

const BOOT_START_TIME = process.hrtime();

export async function start(skipListen = false) {
  await connectToMongoDB();

  logger.info(`Starting server on port ${process.env.PORT}, deployed: ${isDeployed}`);

  // biome-ignore lint/suspicious/noExplicitAny: Need to figure out winston transport types.
  const transports: any[] = [];

  if (isDeployed) {
    transports.push(
      new LoggingWinston({
        defaultCallback: (error): void => {
          if (error) {
            logger.error(`Error occurred: ${error}`);
          }
        },
      })
    );
  } else {
    checkModelsStrict();
  }

  try {
    const terrenoApp = TerrenoApp.create({
      auth: {
        refreshToken: {
          secret: process.env.REFRESH_TOKEN_SECRET!,
        },
        session: {
          secret: process.env.SESSION_SECRET!,
        },
        token: {
          expiresIn: process.env.TOKEN_EXPIRES_IN,
          issuer: process.env.TOKEN_ISSUER!,
          secret: process.env.TOKEN_SECRET!,
        },
        // biome-ignore lint/suspicious/noExplicitAny: Typing this User model is a pain.
        userModel: User as any,
      },
      health: {
        check: async () => {
          const dbConnected = mongoose.connection.readyState === 1;
          return {
            details: {
              database: dbConnected ? "connected" : "disconnected",
              uptime: process.uptime(),
            },
            healthy: dbConnected,
          };
        },
      },
      hooks: {
        onListening: (_server, port) => {
          const totalBootTime = process.hrtime(BOOT_START_TIME);
          const totalBootTimeMs = Math.round(totalBootTime[0] * 1000 + totalBootTime[1] * 0.000001);
          logger.debug(`Total server boot completed in ${totalBootTimeMs}ms on port ${port}`);
        },
      },
      logging: {
        disableConsoleColors: isDeployed,
        disableConsoleLogging: isDeployed,
        disableFileLogging: isDeployed,
        level: Configuration.get<string>("LOGGING_LEVEL") as "debug" | "info" | "warn" | "error",
        logRequests: Boolean(!isDeployed),
        transports,
      },
      server: {
        port: Number(process.env.PORT) || 9000,
        skipListen,
      },
      shutdown: {
        onShutdown: async () => {
          await mongoose.disconnect();
        },
      },
    })
      .addModelRouter("/todos", Todo, {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsOwner],
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsOwner],
          update: [Permissions.IsOwner],
        },
        preCreate: (body, req) => {
          return {
            ...body,
            ownerId: (req.user as UserDocument)?._id,
          } as TodoDocument;
        },
        queryFields: ["completed", "ownerId"],
        queryFilter: OwnerQueryFilter,
        sort: "-created",
      })
      .addModelRouter("/users", User, {
        permissions: {
          create: [Permissions.IsAdmin],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAdmin],
          read: [Permissions.IsAdmin],
          update: [Permissions.IsAdmin],
        },
        queryFields: ["email", "name"],
        // biome-ignore lint/suspicious/noExplicitAny: Generic
        responseHandler: async (value, _method, _req, _options): Promise<any> => {
          const serialize = (doc: UserDocument): Record<string, unknown> => {
            const obj = doc.toObject ? doc.toObject() : doc;
            // biome-ignore lint/suspicious/noExplicitAny: Generic
            const {hash, salt, ...rest} = obj as any;
            return rest as Record<string, unknown>;
          };
          if (Array.isArray(value)) {
            return value.map(serialize);
          }
          return serialize(value as UserDocument);
        },
        sort: "-created",
      });

    if (skipListen) {
      return terrenoApp.build();
    }

    const {app} = await terrenoApp.start();
    return app;
  } catch (error) {
    logger.error(`Error in start function: ${error}`);
    logger.error(`Error setting up server: ${error}`);
    throw error;
  }
}

process.on("unhandledRejection", (error: unknown) => {
  logger.error(`unhandledRejection: ${(error as Error).message}\n${(error as Error).stack}`);
  Sentry.captureException(error);
});

process.on("uncaughtException", (error: unknown) => {
  logger.error(`uncaughtException: ${(error as Error).message}\n${(error as Error).stack}`);
  Sentry.captureException(error);
});
