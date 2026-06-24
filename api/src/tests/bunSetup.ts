import {registerBackendPreload, registerSimpleMongoPreload} from "@terreno/test";

const useFixtureCache = process.env.TERRENO_TEST_USE_FIXTURE_CACHE === "true";

if (useFixtureCache) {
  registerBackendPreload({
    connectMongoInBeforeAll: true,
    loadTestDataFromCache: async () => {
      const {loadTestDataFromCache} = await import("./mongoTestSetup");
      await loadTestDataFromCache();
    },
    mongo: {
      baseDatabaseName: "terrenoTest_base",
      useReplSet: true,
    },
    testEnv: {
      tokenIssuer: "terreno-api.test",
    },
    useTransactions: true,
  });
} else {
  registerSimpleMongoPreload({
    testEnv: {
      tokenIssuer: "terreno-api.test",
    },
  });
}
