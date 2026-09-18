/**
 * Dependency-manifest analysis for the e2e affected gate.
 *
 * A `package.json` edit matters only when it changes something other than
 * dependency ranges, scripts, or the version — the resolved tree is what the
 * app actually bundles, and that lives in `bun.lock`. A lockfile edit matters
 * only when a package the e2e surface imports (directly or transitively)
 * changes resolution.
 */
const DEPENDENCY_KEYS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "trustedDependencies",
];

/** package.json keys that cannot change what the app or backend runs. */
const NON_RUNTIME_KEYS = [...DEPENDENCY_KEYS, "scripts", "version", "catalog", "catalogs"];

export interface LockfilePackage {
  dependencies: string[];
  name: string;
  resolution: string;
}

/**
 * bun.lock is JSON with trailing commas. Base64 integrity hashes contain `//`,
 * so comment stripping would corrupt the file; only trailing commas are
 * removed.
 */
export const parseLockfile = (source: string): Record<string, LockfilePackage> => {
  const parsed = JSON.parse(source.replace(/,(\s*[}\]])/g, "$1")) as {
    packages?: Record<string, unknown[]>;
  };
  const packages: Record<string, LockfilePackage> = {};
  for (const [key, entry] of Object.entries(parsed.packages ?? {})) {
    const descriptor = typeof entry[0] === "string" ? entry[0] : "";
    const atIndex = descriptor.lastIndexOf("@");
    const name = atIndex > 0 ? descriptor.slice(0, atIndex) : (key.split("/").pop() ?? key);
    const meta = (entry[2] ?? {}) as Record<string, Record<string, string> | undefined>;
    const dependencies = new Set<string>();
    for (const group of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      for (const dependency of Object.keys(meta[group] ?? {})) {
        dependencies.add(dependency);
      }
    }
    packages[key] = {dependencies: [...dependencies], name, resolution: descriptor};
  }
  return packages;
};

/** Resolves a dependency of `parentKey` the way bun's lockfile nests installs. */
export const resolveLockfileKey = ({
  dependency,
  lockfile,
  parentKey,
}: {
  dependency: string;
  lockfile: Record<string, LockfilePackage>;
  parentKey: string;
}): string | undefined => {
  const nested = `${parentKey}/${dependency}`;
  if (lockfile[nested]) {
    return nested;
  }
  return lockfile[dependency] ? dependency : undefined;
};

/**
 * Every `name@version` install reachable from `roots`. Comparing these sets
 * across revisions ignores hoisting churn: a dependency that keeps the same
 * version through a different lockfile entry is not a change.
 */
export const reachableResolutions = ({
  lockfile,
  roots,
}: {
  lockfile: Record<string, LockfilePackage>;
  roots: Iterable<string>;
}): Set<string> => {
  const visited = new Set<string>();
  const resolutions = new Set<string>();
  const queue = [...roots].filter((name) => lockfile[name] !== undefined);
  while (queue.length > 0) {
    const key = queue.pop();
    if (!key || visited.has(key)) {
      continue;
    }
    visited.add(key);
    const entry = lockfile[key];
    if (!entry) {
      continue;
    }
    resolutions.add(entry.resolution);
    for (const dependency of entry.dependencies) {
      const resolved = resolveLockfileKey({dependency, lockfile, parentKey: key});
      if (resolved) {
        queue.push(resolved);
      }
    }
  }
  return resolutions;
};

/** Installs that differ between two lockfile revisions within `roots`' closure. */
export const changedRuntimeDependencies = ({
  baseLockfile,
  headLockfile,
  roots,
}: {
  baseLockfile: Record<string, LockfilePackage>;
  headLockfile: Record<string, LockfilePackage>;
  roots: Iterable<string>;
}): string[] => {
  const rootNames = [...roots];
  const base = reachableResolutions({lockfile: baseLockfile, roots: rootNames});
  const head = reachableResolutions({lockfile: headLockfile, roots: rootNames});
  const changed = new Set<string>();
  for (const resolution of head) {
    if (!base.has(resolution)) {
      changed.add(resolution);
    }
  }
  for (const resolution of base) {
    if (!head.has(resolution)) {
      changed.add(resolution);
    }
  }
  return [...changed].sort();
};

const withoutNonRuntimeKeys = (source: string): string => {
  const parsed = JSON.parse(source) as Record<string, unknown>;
  for (const key of NON_RUNTIME_KEYS) {
    delete parsed[key];
  }
  return JSON.stringify(parsed, Object.keys(parsed).sort());
};

/**
 * True when a package.json change touches more than dependency ranges,
 * scripts, or the version — for example `exports`, `main`, or workspaces.
 */
export const isManifestChangeMaterial = ({base, head}: {base: string; head: string}): boolean => {
  try {
    return withoutNonRuntimeKeys(base) !== withoutNonRuntimeKeys(head);
  } catch {
    return true;
  }
};
