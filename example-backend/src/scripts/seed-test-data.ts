/**
 * Seed test data for E2E testing
 *
 * Run with: bun run src/scripts/seed-test-data.ts
 */

import {logger} from "@terreno/api";
import mongoose from "mongoose";
import {User} from "../models/user";
import {connectToMongoDB} from "../utils/database";

interface SeedUser {
  admin?: boolean;
  email: string;
  name: string;
  password: string;
}

const TEST_USERS: SeedUser[] = [
  {
    email: "test@example.com",
    name: "Test User",
    password: "testpassword123",
  },
  {
    admin: true,
    email: "superuser@example.com",
    name: "Super User",
    password: "testpassword123",
  },
];

const seedUser = async (testUser: SeedUser): Promise<void> => {
  const existingUser = await User.findByEmail(testUser.email);
  if (existingUser) {
    logger.info(`Test user already exists: ${testUser.email}`);
    return;
  }

  // Create test user using passport-local-mongoose's register method
  // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose register is not typed on the model
  const user = await (User as any).register(
    {admin: testUser.admin ?? false, email: testUser.email, name: testUser.name},
    testUser.password
  );

  logger.info(`Test user created: ${user.email} (id: ${user._id})`);
};

const main = async (): Promise<void> => {
  try {
    logger.info("Connecting to MongoDB...");
    await connectToMongoDB();

    for (const testUser of TEST_USERS) {
      await seedUser(testUser);
    }

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
