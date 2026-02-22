import {LoggingWinston} from "@google-cloud/logging-winston";
import * as Sentry from "@sentry/bun";
import {
  type AddRoutes,
  type AuthProvider,
  type BetterAuthConfig,
  checkModelsStrict,
  configureOpenApiValidator,
  logger,
  setupServer,
} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import mongoose from "mongoose";
import {addTodoRoutes} from "./api/todos";
import {addUserRoutes} from "./api/users";
import {isDeployed} from "./conf";
import {Configuration} from "./models/configuration";
import {User} from "./models/user";
import {connectToMongoDB} from "./utils/database";

const BOOT_START_TIME = process.hrtime();

const addMiddleware: AddRoutes = (_router, _options) => {
  // Add middleware here
};

const addRoutes: AddRoutes = (router, options): void => {
  // Add API routes with OpenAPI middleware
  addTodoRoutes(router, options);
  addUserRoutes(router, options);
};

/**
 * Builds Better Auth configuration from environment variables.
 * Returns undefined if AUTH_PROVIDER is not set to "better-auth".
 */
const buildBetterAuthConfig = (): BetterAuthConfig | undefined => {
  const authProvider = process.env.AUTH_PROVIDER as AuthProvider | undefined;

  if (authProvider !== "better-auth") {
    return undefined;
  }

  const config: BetterAuthConfig = {
    enabled: true,
    trustedOrigins: ["terreno://", "exp://"],
  };

  // Add Google OAuth if configured
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    config.googleOAuth = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  // Add GitHub OAuth if configured
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    config.githubOAuth = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }

  // Add Apple OAuth if configured
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
    config.appleOAuth = {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    };
  }

  return config;
};

// Return type uses ReturnType to match what setupServer actually returns
export async function start(skipListen = false): Promise<ReturnType<typeof setupServer>> {
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

  const authProvider = (process.env.AUTH_PROVIDER as AuthProvider) ?? "jwt";
  logger.info(
    `Starting server on port ${process.env.PORT}, deployed: ${isDeployed}, authProvider: ${authProvider}`
  );

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
    const betterAuthConfig = buildBetterAuthConfig();

    const result = setupServer({
      addMiddleware,
      addRoutes,
      authProvider,
      betterAuthConfig,
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

    // Register health check plugin
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
    }).register(result.app);

    // Log total boot time
    const totalBootTime = process.hrtime(BOOT_START_TIME);
    const totalBootTimeMs = Math.round(totalBootTime[0] * 1000 + totalBootTime[1] * 0.000001);
    logger.debug(`Total server boot completed in ${totalBootTimeMs}ms`);
    return result;
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
