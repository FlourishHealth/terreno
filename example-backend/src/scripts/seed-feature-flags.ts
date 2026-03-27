/**
 * Seed example feature flags for testing
 *
 * Run with: bun run src/scripts/seed-feature-flags.ts
 *
 * Creates sample boolean and variant flags to demonstrate the feature flags
 * system. Skips any flags that already exist (matched by key).
 */

import {logger} from "@terreno/api";
import {FeatureFlag} from "@terreno/feature-flags";
import mongoose from "mongoose";
import {connectToMongoDB} from "../utils/database";

export const SEED_FLAGS = [
  {
    description: "Show a summary card with todo counts above the todo list",
    enabled: true,
    key: "todo-summary-card",
    name: "Todo Summary Card",
    rolloutPercentage: 100,
    rules: [],
    type: "boolean" as const,
  },
  {
    description: "Allow users to set priority (low/medium/high) on todos",
    enabled: true,
    key: "todo-priority",
    name: "Todo Priority Field",
    rolloutPercentage: 50,
    rules: [
      {
        enabled: true,
        segment: "admin-users",
      },
    ],
    type: "boolean" as const,
  },
  {
    description: "Show dark mode toggle in profile settings",
    enabled: true,
    key: "dark-mode-toggle",
    name: "Dark Mode Toggle",
    rolloutPercentage: 100,
    rules: [],
    type: "boolean" as const,
  },
  {
    description: "A/B test for the profile page layout",
    enabled: true,
    key: "profile-layout",
    name: "Profile Layout Experiment",
    rules: [],
    type: "variant" as const,
    variants: [
      {key: "compact", weight: 50},
      {key: "detailed", weight: 50},
    ],
  },
  {
    description: "Show the AI features tab in the main navigation",
    enabled: false,
    key: "ai-features",
    name: "AI Features",
    rolloutPercentage: 100,
    rules: [
      {
        enabled: true,
        segment: "admin-users",
      },
    ],
    type: "boolean" as const,
  },
];

export const seedFeatureFlags = async (): Promise<{results: string[]; success: boolean}> => {
  let created = 0;
  let skipped = 0;
  const results: string[] = [];

  for (const flag of SEED_FLAGS) {
    const existing = await FeatureFlag.findOne({key: flag.key});
    if (existing) {
      results.push(`Skipped (already exists): ${flag.key}`);
      skipped++;
      continue;
    }

    await FeatureFlag.create(flag);
    results.push(`Created: ${flag.key} (${flag.type}, enabled: ${flag.enabled})`);
    created++;
  }

  results.push(`Done. Created: ${created}, Skipped: ${skipped}`);
  return {results, success: true};
};

const main = async (): Promise<void> => {
  try {
    logger.info("Connecting to MongoDB...");
    await connectToMongoDB();

    const {results} = await seedFeatureFlags();
    for (const line of results) {
      logger.info(line);
    }

    await mongoose.disconnect();
  } catch (error: unknown) {
    logger.error(`Error seeding feature flags: ${error}`);
    process.exit(1);
  }
};

main().catch((error: unknown) => {
  logger.error(`Unhandled error: ${error}`);
  process.exit(1);
});
