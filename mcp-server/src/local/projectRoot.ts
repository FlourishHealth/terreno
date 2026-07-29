import {existsSync, readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

const isTerrenoLayoutRoot = (dir: string): boolean => {
  const pkgPath = join(dir, "package.json");
  if (!existsSync(pkgPath)) {
    return false;
  }
  const hasBackend = existsSync(join(dir, "backend", "package.json"));
  const hasFrontend = existsSync(join(dir, "frontend", "package.json"));
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
