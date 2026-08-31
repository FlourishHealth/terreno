import {existsSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

/** Bootstrap apps use `backend/`; this monorepo uses `example-backend/`. */
export const BACKEND_WORKSPACE_DIR_NAMES = ["backend", "example-backend"] as const;

/** Bootstrap apps use `frontend/`; this monorepo uses `example-frontend/`. */
export const FRONTEND_WORKSPACE_DIR_NAMES = ["frontend", "example-frontend"] as const;

const hasWorkspacePackage = (dir: string, dirNames: readonly string[]): boolean => {
  return dirNames.some((name) => existsSync(join(dir, name, "package.json")));
};

/**
 * First workspace directory that has a `package.json`. Prefers bootstrap names
 * (`backend`, `frontend`) over example-app names.
 */
export const resolveFirstWorkspaceDir = (
  root: string,
  dirNames: readonly string[]
): string | undefined => {
  return dirNames.find((name) => existsSync(join(root, name, "package.json")));
};

const isTerrenoLayoutRoot = (dir: string): boolean => {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return false;
  }
  const hasBackend = hasWorkspacePackage(dir, BACKEND_WORKSPACE_DIR_NAMES);
  const hasFrontend = hasWorkspacePackage(dir, FRONTEND_WORKSPACE_DIR_NAMES);
  if (hasBackend && hasFrontend) {
    return true;
  }
  try {
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as {workspaces?: unknown};
    if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
      return hasBackend || hasFrontend;
    }
  } catch {
    return false;
  }
  return false;
};

/**
 * Resolves the consumer monorepo root (bootstrap layout with backend/ + frontend/)
 * or the nearest package root. Override with `TERRENO_PROJECT_ROOT`.
 */
export const resolveTerrenoProjectRoot = (startDir = process.cwd()): string => {
  const override = process.env.TERRENO_PROJECT_ROOT?.trim();
  if (override) {
    return resolve(override);
  }

  let current = resolve(startDir);
  for (let i = 0; i < 20; i += 1) {
    if (isTerrenoLayoutRoot(current)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return resolve(startDir);
};
