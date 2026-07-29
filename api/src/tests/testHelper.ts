import {ensureTestMongooseConnected} from "@terreno/test";

import {logger} from "../logger";
import {clearTestCollections, createTestData, createTestUsers} from "./createTestData";
import {FoodModel, UserModel} from "./models";
import {loadTestData} from "./mongoTestSetup";
import type {TestData} from "./types";

const defaultTestMongoUri = "mongodb://127.0.0.1/terreno?&connectTimeoutMS=360000";

export const applyTestAuthEnv = (): void => {
  process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_EXPIRES_IN = "30m";
  process.env.TOKEN_ISSUER = "example.com";
  process.env.SESSION_SECRET = "session";
};

const ensureConnected = async (): Promise<void> => {
  await ensureTestMongooseConnected({
    defaultUri: defaultTestMongoUri,
    onConnectError: logger.catch,
  });
  applyTestAuthEnv();
};

/** Seeds only the standard users (legacy helper). */
export const setupDb = async () => {
  await ensureConnected();

  await Promise.all([UserModel.deleteMany({}), FoodModel.deleteMany({})]).catch(logger.catch);

  try {
    const users = await createTestUsers();
    return [users.admin, users.notAdmin, users.adminOther] as const;
  } catch (error) {
    logger.error("Error setting up DB", error);
    throw error;
  }
};

/** Seeds users, foods, and required docs — the recommended API test baseline. */
export const setupTestData = async (): Promise<TestData> => {
  await ensureConnected();

  if (process.env.TERRENO_TEST_USE_FIXTURE_CACHE === "true") {
    return loadTestData();
  }

  return createTestData();
};

/** Clears all API test collections without re-seeding. */
export const resetTestCollections = clearTestCollections;

export {createTestData} from "./createTestData";
export {loadTestData} from "./mongoTestSetup";
