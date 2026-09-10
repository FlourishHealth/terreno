import type mongoose from "mongoose";

import {assertMigrationsAllowed} from "./gate";
import {checkMigrationFiles} from "./load";
import {runMigrations} from "./runner";

export interface StartupMigrationsOption {
  dir: string;
  runOnStart?: boolean;
}

export const runStartupMigrations = async ({
  env = process.env,
  migrations,
  mongoose: mongooseNs,
}: {
  env?: NodeJS.ProcessEnv;
  migrations?: StartupMigrationsOption;
  mongoose: typeof mongoose;
}): Promise<{applied: string[]; ran: boolean}> => {
  if (!migrations?.runOnStart) {
    return {applied: [], ran: false};
  }

  assertMigrationsAllowed({
    allowEnv: env.ALLOW_MIGRATIONS === "true",
    dryRun: false,
    force: true,
    isProduction: env.NODE_ENV === "production",
  });

  const loaded = await checkMigrationFiles({dir: migrations.dir});
  const result = await runMigrations({
    connection: mongooseNs.connection,
    dryRun: false,
    migrations: loaded,
    mongoose: mongooseNs,
  });
  return {applied: result.applied, ran: true};
};
