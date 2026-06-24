/**
 * Run any admin script from the command line.
 *
 * Exposes every script registered on the admin panel (see ../adminScripts.ts) as a
 * CLI so they can be run directly from the project. Scripts default to a dry run;
 * pass --wet to apply changes. Arguments are forwarded to the script.
 *
 * Examples:
 *   bun run src/scripts/runAdminScript.ts --list
 *   bun run src/scripts/runAdminScript.ts countRecords --help
 *   bun run src/scripts/runAdminScript.ts countRecords --model todos
 *   bun run src/scripts/runAdminScript.ts seedFeatureFlags --wet
 *
 * Or via the package script:
 *   bun run script <name> [--wet] [args...]
 */

import {runScriptCli} from "@terreno/admin-backend";
import {logger} from "@terreno/api";
import mongoose from "mongoose";

import {adminScripts} from "../adminScripts";
import {Configuration} from "../models/configuration";
import {connectToMongoDB} from "../utils/database";

const main = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  const needsDb = !argv.includes("--list") && !argv.includes("--help") && !argv.includes("-h");

  if (needsDb) {
    await connectToMongoDB();
  }

  // Defer the process exit to us so we can disconnect from MongoDB cleanly.
  const result = await runScriptCli({
    argv,
    exit: false,
    programName: "bun run script",
    scripts: adminScripts,
  });

  if (needsDb) {
    await Configuration.shutdown();
    await mongoose.disconnect();
  }

  process.exit(result.exitCode);
};

main().catch((error: unknown) => {
  logger.error(`Failed to run admin script: ${error}`);
  process.exit(1);
});
