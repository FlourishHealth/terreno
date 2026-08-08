import * as fs from "node:fs";
import * as path from "node:path";

import {createMongoTestCache} from "@terreno/test";

import {createTestData, loadTestDataFromDocuments, toCachedTestData} from "./createTestData";
import type {CachedTestData, TestData} from "./types";

const moduleDir = __dirname;
const defaultCacheDir =
  process.env.TERRENO_TEST_CACHE_DIR || path.join("/tmp", "terreno-api-test-cache");

const apiTestCache = createMongoTestCache({
  baseDatabaseName: "terrenoTest_base",
  cacheDir: defaultCacheDir,
  createTestData: async (): Promise<CachedTestData> => {
    const testData = await createTestData();
    return toCachedTestData(testData);
  },
  sourceDirs: [path.resolve(moduleDir, "..")],
});

export const {cacheFilesExist, cleanCache, loadTestDataFromCache, setupTestCache} = apiTestCache;

let cachedTestData: TestData | undefined;

/** Loads fixture documents after the collection cache has been restored. */
export const loadTestData = async (): Promise<TestData> => {
  if (cachedTestData) {
    return cachedTestData;
  }

  const cachedFilePath = path.join(defaultCacheDir, "cached-data.json");
  const cached = JSON.parse(fs.readFileSync(cachedFilePath, "utf-8")) as CachedTestData;
  cachedTestData = await loadTestDataFromDocuments(cached);
  return cachedTestData;
};

export const resetCachedTestData = (): void => {
  cachedTestData = undefined;
};

if (process.argv[1]?.includes("mongoTestSetup")) {
  const command = process.argv[2];
  const force = process.argv.includes("--force");

  void (async (): Promise<void> => {
    if (command === "setup") {
      await setupTestCache({force});
      process.exit(0);
    }

    if (command === "clean") {
      cleanCache();
      resetCachedTestData();
      process.exit(0);
    }

    if (command === "status") {
      console.info(`[mongoTestSetup] cache exists: ${cacheFilesExist()}`);
      process.exit(0);
    }

    console.error(
      `[mongoTestSetup] Unknown command: ${command ?? "(none)"}. Usage: setup | clean | status`
    );
    process.exit(1);
  })();
}
