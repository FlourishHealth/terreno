import {LoggingWinston} from "@google-cloud/logging-winston";
import * as Sentry from "@sentry/bun";
import {AdminApp, DocumentStorageApp} from "@terreno/admin-backend";
import {LangfuseApp} from "@terreno/ai";
import {
  type AuthProvider,
  BetterAuthApp,
  type BetterAuthConfig,
  ConsentApp,
  ConsentForm,
  ConsentResponse,
  checkModelsStrict,
  configureOpenApiValidator,
  logger,
  TerrenoApp,
} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import type express from "express";
import mongoose from "mongoose";
import {addAiRoutes} from "./api/ai";
import {addSettingsRoutes} from "./api/settings";
import {todoRouter} from "./api/todos";
import {userRouter} from "./api/users";
import {isDeployed} from "./conf";
import {consentDefinitions} from "./consentDefinitions";
import {AppConfiguration} from "./models/appConfiguration";
import {Configuration} from "./models/configuration";
import {Todo} from "./models/todo";
import {User} from "./models/user";
import {connectToMongoDB} from "./utils/database";

const BOOT_START_TIME = process.hrtime();

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

    const terraApp = new TerrenoApp({
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
      .configure(AppConfiguration)
      .register({register: (app: express.Application) => addAiRoutes(app)})
      .register({register: (app: express.Application) => addSettingsRoutes(app)})
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
        new DocumentStorageApp({
          basePath: "/admin/documents",
          bucketName: process.env.GCS_BUCKET ?? "",
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
            {
              displayName: "Consent Forms",
              fieldOrder: [
                "title",
                "slug",
                "type",
                "version",
                "order",
                "active",
                "required",
                "content",
                "defaultLocale",
                "requireScrollToBottom",
                "captureSignature",
                "agreeButtonText",
                "allowDecline",
                "declineButtonText",
                "checkboxes",
              ],
              fieldOverrides: {
                checkboxes: {widget: "checkbox-list"},
                content: {widget: "markdown"},
              },
              listFields: ["title", "type", "version", "active", "order"],
              model: ConsentForm,
              routePath: "/consent-forms",
            },
            {
              displayName: "Consent Responses",
              listFields: ["userId", "agreed", "locale", "agreedAt"],
              model: ConsentResponse,
              routePath: "/consent-responses",
            },
          ],
          scripts: [
            {
              description: "Count all todos and users in the database",
              name: "countRecords",
              runner: async (wetRun) => {
                const todoCount = await Todo.countDocuments();
                const userCount = await User.countDocuments();
                const results = [`Found ${todoCount} todos`, `Found ${userCount} users`];
                if (wetRun) {
                  results.push("Wet run: no additional changes made by this script");
                } else {
                  results.push("Dry run: no changes made");
                }
                return {results, success: true};
              },
            },
            {
              description:
                "Sync consent forms (Terms of Service, Privacy Policy) from code definitions to the database",
              name: "syncConsents",
              runner: async (wetRun) => {
                const {syncConsents: sync} = await import("@terreno/api");
                const result = await sync(consentDefinitions, {
                  deactivateRemoved: true,
                  dryRun: !wetRun,
                });
                const results: string[] = [];
                if (result.created.length > 0) {
                  results.push(`Created: ${result.created.join(", ")}`);
                }
                if (result.updated.length > 0) {
                  results.push(`Updated: ${result.updated.join(", ")}`);
                }
                if (result.deactivated.length > 0) {
                  results.push(`Deactivated: ${result.deactivated.join(", ")}`);
                }
                if (result.unchanged.length > 0) {
                  results.push(`Unchanged: ${result.unchanged.join(", ")}`);
                }
                if (results.length === 0) {
                  results.push("Nothing to do");
                }
                return {results, success: true};
              },
            },
          ],
        })
      )
      .register(
        new ConsentApp({
          auditTrail: true,
          resolveConsentForms: (user, forms) => (user.admin ? [] : forms),
          supportedLocales: ["en", "es"],
        })
      );

    // Register Better Auth plugin if configured
    if (betterAuthConfig) {
      // biome-ignore lint/suspicious/noExplicitAny: User model type mismatch
      terraApp.register(new BetterAuthApp({config: betterAuthConfig, userModel: User as any}));
    }

    // Register Langfuse plugin if configured
    if (process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY) {
      terraApp.register(
        new LangfuseApp({
          baseUrl: process.env.LANGFUSE_BASE_URL,
          organization: process.env.LANGFUSE_ORGANIZATION,
          project: process.env.LANGFUSE_PROJECT,
          projectId: process.env.LANGFUSE_PROJECT_ID,
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
        })
      );
    }

    const app = terraApp.start();

    // Log total boot time
    const totalBootTime = process.hrtime(BOOT_START_TIME);
    const totalBootTimeMs = Math.round(totalBootTime[0] * 1000 + totalBootTime[1] * 0.000001);
    logger.debug(`Total server boot completed in ${totalBootTimeMs}ms`);
    return app;
  } catch (error) {
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
