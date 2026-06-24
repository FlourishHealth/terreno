export {
  ensureMongoBinary,
} from "./mongo/ensureMongoBinary";

export {setTerrenoTestEnv, type TerrenoTestEnvOptions} from "./env/setTerrenoTestEnv";

export {
  DEFAULT_LOCAL_MONGO_URI,
  buildDatabaseUri,
  ensureTestMongooseConnected,
  splitMongoUri,
  type EnsureTestMongooseConnectedOptions,
  type SplitMongoUriResult,
} from "./mongo/connection";

export {
  getMongoServerUri,
  initializeModels,
  restartMongoServer,
  startMongoServer,
  stopMongoServer,
  waitForDatabaseReady,
  type MemoryMongoHandle,
  type MongoServerOptions,
} from "./mongo/mongoServer";

export {createMongoTestCache, type MongoTestCacheController, type MongoTestCacheOptions} from "./cache/mongoTestCache";

export {
  abortTestTransaction,
  getTestSession,
  installTransactionPatches,
  resetTestSessionAfterReconnect,
  startTestTransaction,
} from "./transaction/testTransaction";

export {createLogSilencer, registerLogSilencing, type SilenceLogsController, type SilenceLogsOptions} from "./logging/silenceLogs";

export {registerSentryBunMock} from "./mocks/sentryBun";

export {authAsUser, type AuthAsUserOptions, type AuthUserCredentials} from "./http/authAsUser";
export {getBaseServer, type GetBaseServerOptions} from "./http/getBaseServer";

export {ensureAllIndexes} from "./utils/ensureAllIndexes";
export {timeout} from "./utils/timeout";
export {waitForDocument, waitForDocuments, type WaitForDocumentsOptions} from "./utils/waitForDocuments";

export {
  registerBackendPreload,
  registerSimpleMongoPreload,
  type BackendPreloadOptions,
} from "./preload/registerBackendPreload";
