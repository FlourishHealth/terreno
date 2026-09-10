import {join} from "node:path";
import {fileURLToPath} from "node:url";

/** App-owned migration files live at the example-backend package root. */
export const EXAMPLE_MIGRATIONS_DIR = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "migrations"
);
