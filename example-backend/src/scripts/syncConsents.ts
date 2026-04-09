/**
 * Sync consent form definitions to the database.
 *
 * Creates or updates consent forms to match the definitions in consentDefinitions.ts.
 * When content changes, a new version is published so users are prompted to re-consent.
 *
 * Run with: bun run src/scripts/syncConsents.ts
 * Dry run:  DRY_RUN=true bun run src/scripts/syncConsents.ts
 */

import "dotenv/config";
import {logger, syncConsents} from "@terreno/api";
import mongoose from "mongoose";
import {consentDefinitions} from "../consentDefinitions";
import {connectToMongoDB} from "../utils/database";

const main = async (): Promise<void> => {
  await connectToMongoDB();

  const dryRun = process.env.DRY_RUN === "true";
  const result = await syncConsents(consentDefinitions, {deactivateRemoved: true, dryRun});

  logger.info("Sync complete", result);
  await mongoose.disconnect();
};

main().catch((err) => {
  logger.error("syncConsents failed:", err);
  process.exit(1);
});
