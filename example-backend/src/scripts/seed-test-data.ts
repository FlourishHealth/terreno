/**
 * Seed test data for E2E testing
 *
 * Run with: bun run src/scripts/seed-test-data.ts
 */

import "dotenv/config";
import {logger} from "@terreno/api";
import mongoose from "mongoose";
import {User} from "../models/user";
import {connectToMongoDB} from "../utils/database";

const TEST_USER = {
  email: "test@example.com",
  name: "Test User",
  password: "testpassword123",
};

const main = async (): Promise<void> => {
  try {
    logger.info("Connecting to MongoDB...");
    await connectToMongoDB();

    // Check if test user already exists
    const existingUser = await User.findByEmail(TEST_USER.email);
    if (existingUser) {
      logger.info(`Test user already exists: ${TEST_USER.email}`);
      await mongoose.disconnect();
      return;
    }

    // Create test user using passport-local-mongoose's register method
    // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose register is not typed on the model
    const user = await (User as any).register(
      {email: TEST_USER.email, name: TEST_USER.name},
      TEST_USER.password
    );

    logger.info(`Test user created: ${user.email} (id: ${user._id})`);

    await mongoose.disconnect();
    logger.info("Done.");
  } catch (error: unknown) {
    logger.error(`Error seeding test data: ${error}`);
    process.exit(1);
  }
};

main().catch((error: unknown) => {
  logger.error(`Unhandled error: ${error}`);
  process.exit(1);
});
