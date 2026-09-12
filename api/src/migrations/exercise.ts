import type mongoose from "mongoose";
import mongooseNs from "mongoose";

import {checkMigrationFiles} from "./load";
import {runDownMigrations, runMigrations} from "./runner";

export interface ExerciseReversibleMigrationsOptions {
  dir: string;
  connect: () => Promise<mongoose.Connection>;
}

export interface ExerciseReversibleMigrationsResult {
  applied: string[];
  reversed: string[];
  skippedIrreversible: string | null;
}

/**
 * CI helper: apply every file, then roll back in reverse until a file without
 * `down` stops the chain. The irreversible id is recorded; earlier files stay applied.
 */
export const exerciseReversibleMigrations = async ({
  connect,
  dir,
}: ExerciseReversibleMigrationsOptions): Promise<ExerciseReversibleMigrationsResult> => {
  const connection = await connect();
  const migrations = await checkMigrationFiles({dir});
  const upResult = await runMigrations({
    connection,
    dryRun: false,
    migrations,
    mongoose: mongooseNs,
  });

  const reversed: string[] = [];
  let skippedIrreversible: string | null = null;
  for (const migration of [...migrations].reverse()) {
    if (typeof migration.down !== "function") {
      skippedIrreversible = migration.id;
      break;
    }
    const downResult = await runDownMigrations({
      connection,
      dryRun: false,
      migrations,
      mongoose: mongooseNs,
      steps: 1,
    });
    reversed.push(...downResult.reversed);
  }

  return {
    applied: [...upResult.applied, ...upResult.skipped],
    reversed,
    skippedIrreversible,
  };
};
