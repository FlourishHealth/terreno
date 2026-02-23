import {LoggingWinston} from "@google-cloud/logging-winston";
import * as Sentry from "@sentry/bun";
import {AdminApp} from "@terreno/admin-backend";
import {checkModelsStrict, configureOpenApiValidator, logger, TerrenoApp} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import type express from "express";
import mongoose from "mongoose";
import {todoRouter} from "./api/todos";
import {userRouter} from "./api/users";
import {isDeployed} from "./conf";
import {Configuration} from "./models/configuration";
import {Todo} from "./models/todo";
import {User} from "./models/user";
import {connectToMongoDB} from "./utils/database";

const BOOT_START_TIME = process.hrtime();

export async function start(skipListen = false): Promise<express.Application> {
  // Connect to MongoDB first
  await connectToMongoDB();

  // Enable OpenAPI request validation. Strips unknown properties and logs them.
  configureOpenApiValidator({
    onAdditionalPropertiesRemoved: (props: string[], req: {method: string; path: string}) => {
      const msg = `Stripped properties: ${props.join(", ")} on ${req.method} ${req.path}`;
      logger.warn(msg);
      try {
        Sentry.captureMessage(msg);
      } catch {
        // Sentry may not be initialized yet
      }
    },
  });

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
    const app = new TerrenoApp({
      loggingOptions: {
        disableConsoleColors: isDeployed,
        disableConsoleLogging: isDeployed,
        disableFileLogging: isDeployed,
        level: Configuration.get<string>("LOGGING_LEVEL") as "debug" | "info" | "warn" | "error",
        logRequests: Boolean(!isDeployed),
        transports,
      },
      skipListen,
      // biome-ignore lint/suspicious/noExplicitAny: Typing this User model is a pain.
      userModel: User as any,
    })
      .register(todoRouter)
      .register(userRouter)
      .register(
        new HealthApp({
          check: async () => {
            const mongoConnected = mongoose.connection.readyState === 1;
            return {
              details: {
                database: mongoConnected ? "connected" : "disconnected",
                uptime: process.uptime(),
              },
              healthy: mongoConnected,
            };
          },
        })
      )
      .register(
        new AdminApp({
          models: [
            {
              displayName: "Todos",
              listFields: ["title", "completed", "ownerId", "created"],
              model: Todo,
              routePath: "/todos",
            },
            {
              displayName: "Users",
              listFields: ["email", "name", "admin", "created"],
              // biome-ignore lint/suspicious/noExplicitAny: User model type mismatch
              model: User as any,
              routePath: "/users",
            },
          ],
        })
      )
      .start();

    // Log total boot time
    const totalBootTime = process.hrtime(BOOT_START_TIME);
    const totalBootTimeMs = Math.round(totalBootTime[0] * 1000 + totalBootTime[1] * 0.000001);
    logger.debug(`Total server boot completed in ${totalBootTimeMs}ms`);
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
