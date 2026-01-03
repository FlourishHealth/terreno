import {LoggingWinston} from "@google-cloud/logging-winston";
import * as Sentry from "@sentry/node";
import {type AddRoutes, checkModelsStrict, logger, setupServer} from "@terreno/api";
import {addTodoRoutes} from "./api/todos";
import {addUserRoutes} from "./api/users";
import {isDeployed} from "./conf";
import {Configuration} from "./models/configuration";
import {User} from "./models/user";

const BOOT_START_TIME = process.hrtime();

const addMiddleware: AddRoutes = (_router, _options) => {
  // Add middleware here
};

const addRoutes: AddRoutes = (router, options): void => {
  // Add API routes with OpenAPI middleware
  addTodoRoutes(router, options);
  addUserRoutes(router, options);
};

// Return type uses ReturnType to match what setupServer actually returns
export function start(skipListen = false): ReturnType<typeof setupServer> {
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
    const app = setupServer({
      addMiddleware,
      addRoutes,
      loggingOptions: {
        disableConsoleColors: isDeployed,
        disableConsoleLogging: isDeployed,
        disableFileLogging: isDeployed,
        level: Configuration.get<string>("LOGGING_LEVEL") as "debug" | "info" | "warn" | "error",
        logRequests: Boolean(!isDeployed),
        transports,
        // Whether to log when requests are slow.
        // logSlowRequests: false,
      },
      skipListen,
      // biome-ignore lint/suspicious/noExplicitAny: Typing this User model is a pain.
      userModel: User as any,
    });

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
