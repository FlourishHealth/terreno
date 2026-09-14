import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {resolveMigrationDir} from "@terreno/api";

/**
 * App-owned migration files live at the example-backend package root.
 * `bun build --compile` rewrites `import.meta.url` to `$bunfs`; resolve to a
 * real directory (`MIGRATIONS_DIR` or `<cwd>/migrations`) in that case.
 */
export const resolveExampleMigrationsDir = (): string => {
  return resolveMigrationDir({
    dir: join(fileURLToPath(new URL("..", import.meta.url)), "migrations"),
    envDir: process.env.MIGRATIONS_DIR,
  });
};
