import {afterAll, afterEach, beforeAll} from "bun:test";
import {logger} from "@terreno/api";
import mongoose from "mongoose";

// Test database URI
const TEST_MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://localhost:27017/ferns-example-test";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MONGO_CONNECTION = `${process.env.MONGO_URI}/ferns-example-test`;
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_ISSUER = "ferns-example.test";
  process.env.SESSION_SECRET = "sessionSecret";
  process.env.CRON_SECRET_KEY = "cronSecret";
  process.env.REFRESH_TOKEN_SECRET = "refreshTokenSecret";
  process.env.FORM_SIGNING_KEY = "formSigningKey";
  process.env.API_URL = "http://localhost:3000";
  process.env.TASKS_URL = "http://localhost:3000";
  process.env.GCP_TASKS_USER_SESSIONS_QUEUE = "TESTuserSessionsQueue";
  process.env.GCP_TASKS_FITBIT_REFRESH_QUEUE = "TESTfitbitRefreshQueue";
  process.env.GCP_PROJECT = "TESTproject";
  process.env.GCP_LOCATION = "TESTlocation";
  process.env.GCP_SERVICE_ACCOUNT_EMAIL = "TESTserviceAccountEmail@ferns-example.test";
  process.env.GCP_TASKS_NOTIFICATIONS_QUEUE = "TESTnotificationsQueue";
  process.env.GCP_TASK_PROCESSOR_QUEUE = "TESTtaskProcessorQueue";
  process.env.GEMINI_API_KEY = "test-api-key";
  process.env.SLACK_WEBHOOKS = '{"default": "http://localhost:3000/slack/TEST"}';
  process.env.GOOGLE_CHAT_WEBHOOKS = '{"default": "http://localhost:3000/googleChat/TEST"}';
  process.env.TOKEN_EXPIRES_IN = "1h";
  process.env.REFRESH_TOKEN_EXPIRES_IN = "90d";
  process.env.STAFF_REFRESH_TOKEN_EXPIRES_IN = "60m";
  // Connect to test database
  try {
    await mongoose.connect(TEST_MONGO_URI);
    logger.info("Connected to test database");
  } catch (error) {
    logger.error("Failed to connect to test database:", error);
    throw error;
  }
});

afterEach(async () => {
  // Clean up database after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  // Disconnect from test database
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  logger.info("Disconnected from test database");
});
