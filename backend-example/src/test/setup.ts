import {afterAll, afterEach, beforeAll} from "bun:test";
import {logger} from "@terreno/api";
import mongoose from "mongoose";

// Test database URI
const TEST_MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://localhost:27017/ferns-example-test";

beforeAll(async () => {
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
