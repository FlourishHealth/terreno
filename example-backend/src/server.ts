import * as Sentry from "@sentry/bun";
import {AdminApp, type AdminAuditEvent, DocumentStorageApp} from "@terreno/admin-backend";
import {AdminSpaServeApp} from "@terreno/admin-spa";
import {AIAdminApp, LangfuseApp} from "@terreno/ai";
import {
  BetterAuthApp,
  backfillAdmins,
  ConsentApp,
  checkModelsStrict,
  configureOpenApiValidator,
  createBetterAuth,
  getMongoClientFromMongoose,
  logger,
  type ModelRouterOptions,
  type ModelRouterRegistration,
  RealtimeApp,
  rbacRouter,
  SyncApp,
  syncConsents,
  TerrenoApp,
  type UserModel as TerrenoAuthUserModel,
  VersionCheckPlugin,
} from "@terreno/api";
import {HealthApp} from "@terreno/api-health";
import {
  CommsApp,
  ConsoleMailProvider,
  ConsoleSmsProvider,
  ConsoleVerificationProvider,
  getCommsService,
} from "@terreno/comms";
import {type ExpoPushClient, ExpoPushProvider} from "@terreno/comms/adapters/expoPush";
import {SendGridMailProvider} from "@terreno/comms/adapters/sendgrid";
import {type TwilioSmsClient, TwilioSmsProvider} from "@terreno/comms/adapters/twilioSms";
import {type TwilioVerifyClient, TwilioVerifyProvider} from "@terreno/comms/adapters/twilioVerify";
import {FeatureFlagsApp} from "@terreno/feature-flags";
import {Expo} from "expo-server-sdk";
import express from "express";
import mongoose from "mongoose";
import twilio from "twilio";
import {access} from "./access";
import {adminScripts} from "./adminScripts";
import {addAdminUserRoutes} from "./api/adminUsers";
import {addAiRoutes} from "./api/ai";
import {addDevCommsRoutes} from "./api/commsDev";
import {addLoadTestRoutes} from "./api/loadtest";
import {projectRouter} from "./api/projects";
import {addSettingsRoutes} from "./api/settings";
import {todoRouter} from "./api/todos";
import {usersRouter} from "./api/users";
import {registerUsersTodoStatusTool} from "./api/usersTodoStatus";
import {isDeployed, isWebsocketService, WEBSOCKETS_DEBUG} from "./conf";
import {consentDefinitions} from "./consentDefinitions";
import {AdminAuditLog} from "./models/adminAuditLog";
import {AppConfiguration} from "./models/appConfiguration";
import {Configuration} from "./models/configuration";
import {User} from "./models/user";
import {seedDefaultData} from "./scripts/seed-test-data";
import {resolveTwilioSmsEnvConfig} from "./twilioSmsEnv";
import {resolveTwilioVerifyEnvConfig} from "./twilioVerifyEnv";
import {buildBetterAuthConfig, getAuthProvider, getWebOrigins} from "./utils/betterAuthConfig";
import {connectToMongoDB} from "./utils/database";
import {io} from "./websockets";

const BOOT_START_TIME = process.hrtime();

type RegisterRoutesWithOptions = (
  router: express.Router,
  options?: Partial<ModelRouterOptions<unknown>>
) => void;

const createOpenApiAwareRouteRegistration = (
  registerRoutes: RegisterRoutesWithOptions
): ModelRouterRegistration => {
  const buildRouter = (openApi?: unknown): express.Router => {
    const router = express.Router();
    const routeOptions = openApi ? ({openApi} as Partial<ModelRouterOptions<unknown>>) : undefined;
    registerRoutes(router, routeOptions);
    return router;
  };

  const registration: ModelRouterRegistration = {
    __type: "modelRouter",
    _buildWithContext: ({openApi}) => buildRouter(openApi),
    model: {} as ModelRouterRegistration["model"],
    options: {} as ModelRouterRegistration["options"],
    path: "/",
    // Placeholder router; TerrenoApp uses _buildWithContext during registration.
    router: express.Router(),
  };
  return registration;
};

export const start = async (skipListen = false): Promise<express.Application> => {
  // Connect to MongoDB first
  await connectToMongoDB();
  await access.roles.seedDefaults();
  await backfillAdmins({
    access,
    userModel: User as unknown as TerrenoAuthUserModel,
    wetRun: process.env.RBAC_BACKFILL_ADMINS === "true",
  });

  if (process.env.SEED_DEFAULTS === "true") {
    logger.info("Seeding default example data");
    await seedDefaultData();
  }

  // Sync default consent forms on startup
  await syncConsents(consentDefinitions).catch((err: unknown) => {
    logger.warn(`Failed to sync consent forms on startup: ${err}`);
  });

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

  const authProvider = getAuthProvider();
  logger.info(
    `Starting server on port ${process.env.PORT}, deployed: ${isDeployed}, authProvider: ${authProvider}`
  );

  if (!isDeployed) {
    checkModelsStrict();
  }

  try {
    const betterAuthConfig = buildBetterAuthConfig();
    // Build the Better Auth instance eagerly (MongoDB is connected above). It is shared
    // with the RealtimeApp socket auth validator. We cannot use BetterAuthApp.getAuth()
    // for this: plugin.register() (which populates it) runs later inside terraApp.start(),
    // so getAuth() is still undefined at construction time here — that left the socket with
    // only the legacy JWT validator, rejecting Better Auth session tokens on (re)connect.
    const betterAuthInstance = betterAuthConfig
      ? createBetterAuth({
          config: betterAuthConfig,
          mongoClient: getMongoClientFromMongoose(),
          userModel: User as unknown as TerrenoAuthUserModel,
        })
      : undefined;

    const adminWebsocketsDebug = await AppConfiguration.getConfig("debug.websocketsDebug");
    const websocketsDebug = WEBSOCKETS_DEBUG || adminWebsocketsDebug === true;

    const terraApp = new TerrenoApp({
      accessControl: access,
      // Reflect specific web origins (never "*") so Better Auth's credentialed
      // cross-origin requests from the Expo web frontend pass the browser CORS check.
      corsOrigin: getWebOrigins(),
      // Cloud Run captures stdout/stderr. Keeping the console transport avoids making
      // startup depend on LoggingWinston network/auth callbacks before the port opens.
      loggingOptions: {
        disableConsoleColors: isDeployed,
        disableFileLogging: isDeployed,
        level: Configuration.get<string>("LOGGING_LEVEL") as "debug" | "info" | "warn" | "error",
        logRequests: Boolean(!isDeployed),
      },
      // App-owned env: @terreno/api does not read RATE_LIMIT_ENABLED. Unset = limiter off.
      rateLimit: process.env.RATE_LIMIT_ENABLED === "true" ? {store: "memory"} : undefined,
      skipListen,
      userModel: User as unknown as TerrenoAuthUserModel,
    }).configure(AppConfiguration);

    registerUsersTodoStatusTool();

    // Register Better Auth first: registrations mount in order, so its session
    // middleware must be installed before any routes (admin, SPA, model routers)
    // that rely on req.user being populated from the better-auth session.
    if (betterAuthConfig) {
      terraApp.register(
        new BetterAuthApp({
          config: betterAuthConfig,
          userModel: User as unknown as TerrenoAuthUserModel,
        })
      );
    }

    terraApp
      .register(rbacRouter({access, userModel: User as unknown as TerrenoAuthUserModel}))
      .register(createOpenApiAwareRouteRegistration(addAiRoutes))
      .register(
        createOpenApiAwareRouteRegistration(addAdminUserRoutes as RegisterRoutesWithOptions)
      )
      .register(createOpenApiAwareRouteRegistration(addSettingsRoutes))
      .register(createOpenApiAwareRouteRegistration(addLoadTestRoutes))
      .register(createOpenApiAwareRouteRegistration(addDevCommsRoutes))
      .register(todoRouter)
      .register(projectRouter)
      .register(usersRouter)
      // SyncApp mounts the @terreno/syncdb HTTP routes (/sync/snapshot, /sync/mutate,
      // /sync/key) and publishes getUserScopes so RealtimeApp's socket handlers can
      // resolve tenant streams (projects are scoped by the user's organizationIds).
      .register(
        new SyncApp({
          getUserScopes: (user) => {
            return (user as unknown as {organizationIds?: string[]}).organizationIds ?? [];
          },
        })
      )
      .register(new VersionCheckPlugin())
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
      );

    if (isWebsocketService) {
      terraApp.register(
        new RealtimeApp({
          betterAuth: betterAuthInstance
            ? {
                auth: betterAuthInstance,
                userModel: User as unknown as TerrenoAuthUserModel,
              }
            : undefined,
          changeStream: {
            ignoredCollections: ["socketio", "sessions", "socketio_realtime"],
          },
          debug: websocketsDebug,
          // Required by the tenant-scoped `projects` sync stream: socket authorization
          // otherwise falls back to the synthetic JWT-claim user, which carries no
          // `organizationIds`, so tenant streams resolve to nothing and `admin` is
          // trusted from the token instead of the database (Task 9.21).
          userModel: User as unknown as TerrenoAuthUserModel,
        })
      );
    } else {
      logger.info("RealtimeApp disabled because BACKEND_SERVICE is not websockets/all");
    }

    if (process.env.COMMS_ENABLED !== "false") {
      const sendGridApiKey = process.env.SENDGRID_API_KEY;
      const mailProvider = sendGridApiKey
        ? new SendGridMailProvider({
            apiKey: sendGridApiKey,
            fromEmail: process.env.COMMS_DEFAULT_FROM,
            fromName: process.env.COMMS_DEFAULT_FROM_NAME,
            ...(process.env.SENDGRID_SANDBOX_MODE === "true" ? {sandboxMode: true} : {}),
          })
        : isDeployed
          ? undefined
          : new ConsoleMailProvider();
      // Inject the SDK client so `bun build --compile` (Cloud Run image) embeds
      // `expo-server-sdk`. `ExpoPushProvider`'s default path uses createRequire
      // and is missing from the compiled binary.
      const expoAccessToken = process.env.EXPO_ACCESS_TOKEN;
      const pushProvider = new ExpoPushProvider({
        accessToken: expoAccessToken,
        client: new Expo(
          expoAccessToken ? {accessToken: expoAccessToken} : {}
        ) as unknown as ExpoPushClient,
        isExpoPushToken: (token: string): boolean => Expo.isExpoPushToken(token),
        onDeadToken: async (token: string): Promise<void> => {
          await getCommsService().deactivatePushToken(token);
        },
        onDeliveryEvent: async (event): Promise<void> => {
          await getCommsService().recordDeliveryEvent(event);
        },
      });

      const twilioSmsConfig = resolveTwilioSmsEnvConfig();
      const twilioVerifyConfig = resolveTwilioVerifyEnvConfig();
      const twilioCreds = twilioSmsConfig ?? twilioVerifyConfig;
      // Inject the SDK client so `bun build --compile` (Cloud Run image) embeds
      // `twilio`. The adapters' default path uses createRequire and is missing
      // from the compiled binary.
      const twilioClient = twilioCreds
        ? twilio(twilioCreds.accountSid, twilioCreds.authToken)
        : undefined;
      const twilioSmsProvider = twilioSmsConfig
        ? new TwilioSmsProvider({
            ...twilioSmsConfig,
            ...(twilioClient ? {client: twilioClient as unknown as TwilioSmsClient} : {}),
          })
        : undefined;
      const smsProvider = twilioSmsProvider ?? (isDeployed ? undefined : new ConsoleSmsProvider());

      const twilioVerifyProvider = twilioVerifyConfig
        ? new TwilioVerifyProvider({
            ...twilioVerifyConfig,
            ...(twilioClient ? {client: twilioClient as unknown as TwilioVerifyClient} : {}),
          })
        : undefined;
      const verificationProvider =
        twilioVerifyProvider ?? (isDeployed ? undefined : new ConsoleVerificationProvider());

      terraApp.register(
        new CommsApp(
          isDeployed
            ? {
                ...(mailProvider ? {mail: mailProvider} : {}),
                ...(smsProvider ? {sms: smsProvider} : {}),
                ...(verificationProvider ? {verification: verificationProvider} : {}),
                defaultFrom: process.env.COMMS_DEFAULT_FROM,
                push: pushProvider,
              }
            : {
                defaultFrom: process.env.COMMS_DEFAULT_FROM,
                mail: mailProvider ?? new ConsoleMailProvider(),
                push: pushProvider,
                sms: smsProvider ?? new ConsoleSmsProvider(),
                verification: verificationProvider ?? new ConsoleVerificationProvider(),
              }
        )
      );
    }

    terraApp
      .register(
        new FeatureFlagsApp({
          liveUpdates: {
            socketIoServer: () => io,
          },
          segments: {
            "admin-users": (user: unknown) => (user as {admin?: boolean}).admin === true,
            "has-name": (user: unknown) => Boolean((user as {name?: string}).name),
            "oauth-users": (user: unknown) =>
              Boolean((user as {oauthProvider?: string}).oauthProvider),
          },
        })
      )
      .register(
        new DocumentStorageApp({
          basePath: "/documents",
          bucketName: process.env.GCS_BUCKET ?? "",
        })
      )
      .register(new AIAdminApp())
      .register(
        new AdminApp({
          accessControl: access,
          customScreens: [
            {
              adminAccess: {action: "syncLab", resource: "adminScreen"},
              description: "Stress-test the local-first sync layer",
              displayName: "SyncDB Load Lab",
              name: "sync-lab",
            },
          ],
          home: {
            slots: {
              contentTop: [],
              main: ["modelStats"],
              navGlobal: ["scriptRunner", "feature-flags-overrides"],
              sidebar: ["versionConfig", "recentActivity"],
            },
            title: "Example administration",
          },
          models: [
            {
              adminAccess: {},
              displayName: "Audit log",
              group: "Platform",
              listFields: ["verb", "modelName", "recordLabel", "recordId", "actorId", "createdAt"],
              model: AdminAuditLog,
              pageSize: 50,
              permissions: {create: false, delete: false, update: false},
              routePath: "/audit-logs",
              searchFields: ["modelName", "recordLabel"],
              sortableFields: ["verb", "modelName", "createdAt"],
            },
          ],
          onAdminAudit: async (event: AdminAuditEvent) => {
            await AdminAuditLog.create({
              actorId:
                event.actorId && mongoose.isValidObjectId(event.actorId)
                  ? new mongoose.Types.ObjectId(event.actorId)
                  : undefined,
              modelName: event.modelName,
              recordId:
                event.recordId && mongoose.isValidObjectId(event.recordId)
                  ? new mongoose.Types.ObjectId(event.recordId)
                  : undefined,
              recordLabel: event.recordLabel,
              verb: event.verb,
            });
          },
          scripts: adminScripts,
        })
      )
      .register(
        new ConsentApp({
          auditTrail: true,
          resolveConsentForms: (user, forms) => (user.admin ? [] : forms),
          supportedLocales: ["en", "es"],
        })
      );

    // Register the standalone admin SPA serve plugin when opted in. Gated on an env
    // flag so it stays off in tests and for backend-only consumers.
    if (process.env.ADMIN_SPA_ENABLED === "true") {
      terraApp.register(
        new AdminSpaServeApp({
          appConfig: {
            brandName: "Terreno Example",
            primaryColor: "#7C3AED",
            providers: ["email", "google"],
          },
          basePath: "/console",
          devProxyTarget: process.env.ADMIN_SPA_DEV_PROXY,
          // Compiled deploys (Cloud Run) must point at the bundled SPA export, since the
          // plugin's __dirname-relative default cannot resolve inside a bun-compiled binary.
          distDir: process.env.ADMIN_SPA_DIST_DIR,
        })
      );
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
};

process.on("unhandledRejection", (error: unknown) => {
  logger.error(`unhandledRejection: ${(error as Error).message}\n${(error as Error).stack}`);
  Sentry.captureException(error);
});

process.on("uncaughtException", (error: unknown) => {
  logger.error(`uncaughtException: ${(error as Error).message}\n${(error as Error).stack}`);
  Sentry.captureException(error);
});
