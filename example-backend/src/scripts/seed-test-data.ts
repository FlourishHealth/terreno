/**
 * Seed test data for E2E testing
 *
 * Run with: bun run src/scripts/seed-test-data.ts
 */

import {ConsentForm, logger} from "@terreno/api";
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

const CONSENT_FORMS = [
  {
    active: true,
    agreeButtonText: "I Accept the Terms",
    captureSignature: true,
    content: new Map([
      [
        "en",
        `# Terms of Service

Welcome to our application. By using our service, you agree to the following terms...

## 1. Acceptance of Terms

By accessing or using our application, you agree to be bound by these Terms of Service.

## 2. Use of Service

You agree to use the service only for lawful purposes and in a way that does not infringe the rights of others.

## 3. Privacy

Your use of the service is also governed by our Privacy Policy.

## 4. Changes to Terms

We reserve the right to modify these terms at any time. We will notify you of any changes.`,
      ],
    ]),
    order: 1,
    required: true,
    requireScrollToBottom: true,
    slug: "terms-of-service",
    title: "Terms of Service",
    type: "terms",
    version: 1,
  },
  {
    active: true,
    content: new Map([
      [
        "en",
        `# Privacy Policy

We are committed to protecting your personal information.

## Information We Collect

We collect information you provide directly to us, such as when you create an account.

## How We Use Your Information

We use the information we collect to provide, maintain, and improve our services.

## Data Security

We implement appropriate technical and organizational measures to protect your personal information.

## Contact Us

If you have any questions about this Privacy Policy, please contact us.`,
      ],
    ]),
    order: 2,
    required: true,
    requireScrollToBottom: true,
    slug: "privacy-policy",
    title: "Privacy Policy",
    type: "privacy",
    version: 1,
  },
  {
    active: true,
    allowDecline: true,
    content: new Map([
      [
        "en",
        `# Data Collection Consent

We would like to collect anonymized usage data to improve our services.

## What We Collect

- App usage patterns (screens visited, features used)
- Device information (OS version, screen size)
- Performance metrics (load times, error rates)

## How It Helps

This data helps us identify bugs, improve performance, and prioritize new features.

## Your Choice

This consent is optional. You can decline without affecting your use of the application. You can change your preference at any time in Settings.`,
      ],
    ]),
    order: 3,
    required: false,
    slug: "data-collection",
    title: "Data Collection Consent",
    type: "research",
    version: 1,
  },
];

const seedUser = async (testUser: SeedUser): Promise<void> => {
  const existingUser = await User.findByEmail(testUser.email);
  if (existingUser) {
    logger.info(`Test user already exists: ${testUser.email}`);
    return;
  }

  // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose register is not typed on the model
  const user = await (User as any).register(
    {admin: testUser.admin ?? false, email: testUser.email, name: testUser.name},
    testUser.password
  );

  logger.info(`Test user created: ${user.email} (id: ${user._id})`);
};

const seedConsentForms = async (): Promise<void> => {
  const slugs = CONSENT_FORMS.map((f) => f.slug);
  const existing = await ConsentForm.find({slug: {$in: slugs}});
  const existingSlugs = new Set(existing.map((f) => f.slug));

  const toCreate = CONSENT_FORMS.filter((f) => !existingSlugs.has(f.slug));

  if (toCreate.length === 0) {
    logger.info(`All ${slugs.length} consent forms already exist`);
    return;
  }

  await ConsentForm.create(toCreate);
  logger.info(
    `Seeded ${toCreate.length} consent form(s): ${toCreate.map((f) => f.slug).join(", ")}`
  );
};

const main = async (): Promise<void> => {
  try {
    logger.info("Connecting to MongoDB...");
    await connectToMongoDB();

    for (const testUser of TEST_USERS) {
      await seedUser(testUser);
    }

    await seedConsentForms();

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
