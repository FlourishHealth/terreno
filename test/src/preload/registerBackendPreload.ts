import {afterAll, afterEach, beforeAll, beforeEach, jest, mock, setSystemTime} from "bun:test";
import {logger} from "@terreno/api";
import mongoose from "mongoose";

import {setTerrenoTestEnv, type TerrenoTestEnvOptions} from "../env/setTerrenoTestEnv";
import {
  createLogSilencer,
  registerLogSilencing,
  type SilenceLogsController,
  type SilenceLogsOptions,
} from "../logging/silenceLogs";
import {registerSentryBunMock} from "../mocks/sentryBun";
import {
  initializeModels,
  startMongoServer,
  stopMongoServer,
  type MongoServerOptions,
} from "../mongo/mongoServer";
import {
  abortTestTransaction,
  installTransactionPatches,
  startTestTransaction,
} from "../transaction/testTransaction";

export interface BackendPreloadOptions {
  disableDb?: boolean;
  mongo?: MongoServerOptions;
  /** When true, `beforeAll` connects via `startMongoServer`. When false, the caller manages mongoose. */
  connectMongoInBeforeAll?: boolean;
  useTransactions?: boolean;
  silenceLogs?: boolean | SilenceLogsOptions;
  sentryMock?: boolean;
  testEnv?: TerrenoTestEnvOptions;
  onBeforeAll?: () => void | Promise<void>;
  onAfterAll?: () => void | Promise<void>;
  onBeforeEach?: () => void | Promise<void>;
  onAfterEach?: () => void | Promise<void>;
  loadModels?: () => Promise<void>;
  loadTestDataFromCache?: () => Promise<void>;
}

type LogSilencer = SilenceLogsController;

const shouldDisableDb = (options: BackendPreloadOptions): boolean => {
  if (options.disableDb) {
    return true;
  }
  return process.env.BUN_TEST_DISABLE_DB === "true";
};

let isServerStarted = false;

/**
 * Registers Bun test lifecycle hooks for Terreno backend packages.
 * Call once from a package preload file (e.g. `api/src/tests/bunSetup.ts`).
 */
export const registerBackendPreload = (options: BackendPreloadOptions = {}): void => {
  const connectMongoInBeforeAll = options.connectMongoInBeforeAll ?? true;

  if (options.sentryMock !== false) {
    registerSentryBunMock();
  }

  let logSilencer: LogSilencer | undefined;
  if (options.silenceLogs !== false) {
    const silencerOptions = typeof options.silenceLogs === "object" ? options.silenceLogs : {};
    if (connectMongoInBeforeAll) {
      registerLogSilencing(silencerOptions);
    } else {
      logSilencer = createLogSilencer(silencerOptions);
    }
  }

  if (options.useTransactions) {
    installTransactionPatches();
  }

  if (!shouldDisableDb(options)) {
    beforeAll(async () => {
      if (connectMongoInBeforeAll) {
        if (!isServerStarted) {
          setTerrenoTestEnv(options.testEnv);
          await startMongoServer(options.mongo);
          if (options.loadModels) {
            await options.loadModels();
          }
          if (options.loadTestDataFromCache) {
            await options.loadTestDataFromCache();
          }
          isServerStarted = true;
        } else {
          await initializeModels();
        }
      }
      await options.onBeforeAll?.();
    }, 60000);

    if (connectMongoInBeforeAll) {
      afterAll(async () => {
        await options.onAfterAll?.();
        await stopMongoServer();
      });
    } else {
      afterAll(async () => {
        await options.onAfterAll?.();
      });
    }
  }

  beforeEach(async () => {
    setTerrenoTestEnv(options.testEnv);
    logSilencer?.reapply();
    logSilencer?.clearLogs();
    if (options.useTransactions) {
      await startTestTransaction();
    }
    await options.onBeforeEach?.();
  });

  afterEach(async () => {
    if (options.useTransactions) {
      await abortTestTransaction();
    }
    setSystemTime();
    mock.clearAllMocks();
    jest.restoreAllMocks();
    logSilencer?.clearLogs();
    await options.onAfterEach?.();
    setTerrenoTestEnv(options.testEnv);
  });
};

/**
 * Simple Mongo preload: single memory server or external URI, no transactions.
 * Matches the historical `@terreno/api` `bunSetup.ts` behavior.
 */
export const registerSimpleMongoPreload = (
  options: Omit<BackendPreloadOptions, "useTransactions" | "connectMongoInBeforeAll"> = {}
): void => {
  let memoryMongo: {getUri: () => string; stop: () => Promise<boolean>} | undefined;
  const defaultLocalMongoUri = "mongodb://127.0.0.1/terreno?&connectTimeoutMS=360000";

  registerBackendPreload({
    ...options,
    connectMongoInBeforeAll: false,
    onAfterAll: async () => {
      await mongoose.connection.close();
      if (memoryMongo) {
        await memoryMongo.stop();
      }
      await options.onAfterAll?.();
    },
    onBeforeAll: async () => {
      let uri = process.env.TERRENO_TEST_MONGODB_URI?.trim();
      if (!uri && process.env.TERRENO_TEST_USE_MEMORY_MONGO === "true") {
        const {MongoMemoryServer} = await import("mongodb-memory-server");
        memoryMongo = await MongoMemoryServer.create();
        uri = memoryMongo.getUri();
      }
      const connectUri = uri ?? defaultLocalMongoUri;
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(connectUri).catch(logger.catch);
      }
      await options.onBeforeAll?.();
    },
    useTransactions: false,
  });
};
