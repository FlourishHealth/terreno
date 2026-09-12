import {APIError} from "../errors";

export interface AssertMigrationsAllowedOptions {
  allowEnv: boolean;
  dryRun: boolean;
  force: boolean;
  isProduction: boolean;
}

export const assertMigrationsAllowed = ({
  allowEnv,
  dryRun,
  force,
  isProduction,
}: AssertMigrationsAllowedOptions): void => {
  if (dryRun) {
    return;
  }
  if (!isProduction) {
    return;
  }
  if (allowEnv && force) {
    return;
  }

  const detail = allowEnv
    ? "Production wet migrations also require --force (or an equivalent boot/admin Apply)."
    : "Set ALLOW_MIGRATIONS=true for production wet migrations.";
  throw new APIError({
    detail,
    status: 403,
    title: "Migrations not allowed",
  });
};
