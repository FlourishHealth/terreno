/**
 * Decides which Playwright shards a change can actually break.
 *
 * The gate is allowed to skip a shard only when every changed file is provably
 * outside that shard's reachable surface. Anything unknown — an unresolved
 * import, a missing base revision, a file the classifier does not recognise —
 * runs the shard.
 */
import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative, sep} from "node:path";

import {classifyChangedFile, GATE_DIRECTORY} from "./changeScope";
import {
  changedRuntimeDependencies,
  isManifestChangeMaterial,
  type LockfilePackage,
  parseLockfile,
} from "./dependencies";
import {
  collectReachable,
  isPassThroughBarrel,
  parseLocalExportNames,
  parseReexports,
  type ReachableGraph,
  readWorkspacePackages,
  resolveSpecifier,
  runtimeSkeleton,
  type WorkspacePackage,
} from "./moduleGraph";
import {hasSameRequestedRuntime} from "./runtimeSlice";
import {pullRequestShards, rootPatternsForShard, type ShardDefinition} from "./shards";

export interface ShardDecision {
  affected: boolean;
  name: string;
  reasons: string[];
}

export interface AffectedResult {
  changedFiles: string[];
  shards: ShardDecision[];
}

export type ReadBaseFile = (path: string) => string | undefined;

type LockfileIndex = Record<string, LockfilePackage>;

const toPosix = (path: string): string => path.split(sep).join("/");

const listFiles = (dir: string): string[] => {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const child = join(dir, entry);
    if (statSync(child).isDirectory()) {
      files.push(...listFiles(child));
      continue;
    }
    files.push(child);
  }
  return files;
};

const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

export const expandRootPatterns = ({
  patterns,
  repoRoot,
}: {
  patterns: string[];
  repoRoot: string;
}): string[] => {
  const roots = new Set<string>();
  for (const pattern of patterns) {
    if (pattern.endsWith("/**")) {
      for (const file of listFiles(join(repoRoot, pattern.slice(0, -3)))) {
        if (SOURCE_FILE.test(file)) {
          roots.add(file);
        }
      }
      continue;
    }
    const file = join(repoRoot, pattern);
    if (existsSync(file)) {
      roots.add(file);
    }
  }
  return [...roots];
};

/**
 * A re-export barrel has no runtime of its own, so it only matters when the
 * target behind a binding the app imports changes.
 */
type ReadSourceAtRevision = (file: string) => string | undefined;

const UNKNOWN_TARGET = "\u0000unknown";

/** Where a barrel's exported binding comes from, in one revision of the tree. */
const resolveBarrelBinding = ({
  barrelFile,
  name,
  readSource,
  repoRoot,
  source,
  workspacePackages,
}: {
  barrelFile: string;
  name: string;
  readSource: ReadSourceAtRevision;
  repoRoot: string;
  source: string;
  workspacePackages: WorkspacePackage[];
}): string => {
  const exportNamesOf = (file: string, seen: Set<string>): Set<string> | undefined => {
    if (seen.has(file)) {
      return new Set();
    }
    seen.add(file);
    const moduleSource = readSource(file);
    if (moduleSource === undefined) {
      return undefined;
    }
    const names = new Set(parseLocalExportNames(moduleSource));
    for (const statement of parseReexports(moduleSource)) {
      if (statement.entries) {
        for (const entry of statement.entries) {
          names.add(entry.exported);
        }
        continue;
      }
      const resolved = resolveSpecifier({
        fromFile: file,
        repoRoot,
        specifier: statement.specifier,
        workspacePackages,
      });
      if (resolved.kind === "external") {
        continue;
      }
      if (resolved.kind !== "file") {
        return undefined;
      }
      const nested = exportNamesOf(resolved.file, seen);
      if (nested === undefined) {
        return undefined;
      }
      for (const nestedName of nested) {
        names.add(nestedName);
      }
    }
    return names;
  };

  const statements = parseReexports(source).filter((statement) => !statement.typeOnly);
  const stars: string[] = [];
  for (const statement of statements) {
    if (statement.entries) {
      const entry = statement.entries.find((candidate) => candidate.exported === name);
      if (entry) {
        return `${statement.specifier}#${entry.local}`;
      }
      continue;
    }
    stars.push(statement.specifier);
  }
  for (const specifier of stars) {
    const resolved = resolveSpecifier({
      fromFile: barrelFile,
      repoRoot,
      specifier,
      workspacePackages,
    });
    if (resolved.kind !== "file") {
      return UNKNOWN_TARGET;
    }
    const names = exportNamesOf(resolved.file, new Set());
    if (names === undefined) {
      return UNKNOWN_TARGET;
    }
    if (names.has(name)) {
      return `${specifier}#${name}`;
    }
  }
  if (parseLocalExportNames(source).includes(name)) {
    return "local";
  }
  // Only a `export type *` statement can publish it; types carry no runtime.
  return parseReexports(source).some((statement) => statement.typeOnly)
    ? "type-only"
    : UNKNOWN_TARGET;
};

/**
 * A pass-through barrel has no runtime of its own, so it only matters when a
 * binding the app imports starts resolving to a different module.
 */
const isBarrelChangeMaterial = ({
  barrelFile,
  baseSource,
  headSource,
  readBaseSource,
  readHeadSource,
  repoRoot,
  requestedNames,
  workspacePackages,
}: {
  barrelFile: string;
  baseSource: string | undefined;
  headSource: string;
  readBaseSource: ReadSourceAtRevision;
  readHeadSource: ReadSourceAtRevision;
  repoRoot: string;
  requestedNames: Set<string> | "all";
  workspacePackages: WorkspacePackage[];
}): boolean => {
  if (requestedNames === "all" || baseSource === undefined) {
    return true;
  }
  if (!isPassThroughBarrel(baseSource) || !isPassThroughBarrel(headSource)) {
    return true;
  }
  for (const name of requestedNames) {
    const base = resolveBarrelBinding({
      barrelFile,
      name,
      readSource: readBaseSource,
      repoRoot,
      source: baseSource,
      workspacePackages,
    });
    const head = resolveBarrelBinding({
      barrelFile,
      name,
      readSource: readHeadSource,
      repoRoot,
      source: headSource,
      workspacePackages,
    });
    if (base === UNKNOWN_TARGET || head === UNKNOWN_TARGET || base !== head) {
      return true;
    }
  }
  return false;
};

interface ShardContext {
  graph: ReachableGraph;
  shard: ShardDefinition;
}

const decideSourceFile = ({
  context,
  path,
  readBaseFile,
  repoRoot,
  workspacePackages,
}: {
  context: ShardContext;
  path: string;
  readBaseFile: ReadBaseFile;
  repoRoot: string;
  workspacePackages: WorkspacePackage[];
}): string | undefined => {
  const absolute = join(repoRoot, path);
  if (context.graph.files.has(absolute)) {
    const baseSource = readBaseFile(path);
    if (baseSource !== undefined && existsSync(absolute)) {
      const headSource = readFileSync(absolute, "utf8");
      if (runtimeSkeleton(baseSource) === runtimeSkeleton(headSource)) {
        return undefined;
      }
      const requestedNames = context.graph.requestedNames.get(absolute);
      if (
        requestedNames !== undefined &&
        requestedNames !== "all" &&
        hasSameRequestedRuntime({baseSource, headSource, requestedNames})
      ) {
        return undefined;
      }
    }
    return `${path} is imported by the ${context.shard.name} surface`;
  }
  const requestedNames = context.graph.barrels.get(absolute);
  if (!requestedNames) {
    return undefined;
  }
  if (!existsSync(absolute)) {
    return `${path} (barrel) was removed`;
  }
  const material = isBarrelChangeMaterial({
    barrelFile: absolute,
    baseSource: readBaseFile(path),
    headSource: readFileSync(absolute, "utf8"),
    readBaseSource: (file) => readBaseFile(toPosix(relative(repoRoot, file))),
    readHeadSource: (file) => (existsSync(file) ? readFileSync(file, "utf8") : undefined),
    repoRoot,
    requestedNames,
    workspacePackages,
  });
  return material ? `${path} re-export target changed for an imported binding` : undefined;
};

export const computeAffected = ({
  changedFiles,
  readBaseFile,
  repoRoot,
  rootPatternsFor = rootPatternsForShard,
  shards = pullRequestShards(),
}: {
  changedFiles: string[];
  readBaseFile: ReadBaseFile;
  repoRoot: string;
  rootPatternsFor?: (options: {shard: ShardDefinition}) => string[];
  shards?: ShardDefinition[];
}): AffectedResult => {
  const normalized = changedFiles.map((file) => toPosix(file)).filter((file) => file.length > 0);
  const workspacePackages = readWorkspacePackages({repoRoot});
  const contexts: ShardContext[] = shards.map((shard) => ({
    graph: collectReachable({
      repoRoot,
      roots: expandRootPatterns({patterns: rootPatternsFor({shard}), repoRoot}),
      workspacePackages,
    }),
    shard,
  }));

  const globalReasons: string[] = [];
  const sourceChanges: string[] = [];
  const lockfileChanges: string[] = [];

  for (const path of normalized) {
    const scope = classifyChangedFile({path});
    if (scope === "inert") {
      continue;
    }
    if (scope === "source") {
      sourceChanges.push(path);
      continue;
    }
    if (scope === "manifest") {
      if (path === "bun.lock") {
        lockfileChanges.push(path);
        continue;
      }
      const base = readBaseFile(path);
      const absolute = join(repoRoot, path);
      if (base === undefined || !existsSync(absolute)) {
        globalReasons.push(`${path} was added or removed`);
        continue;
      }
      if (isManifestChangeMaterial({base, head: readFileSync(absolute, "utf8")})) {
        globalReasons.push(`${path} changed outside dependency ranges`);
      }
      continue;
    }
    globalReasons.push(
      GATE_DIRECTORY.test(path)
        ? `${path} changes this gate, so every shard runs`
        : `${path} is outside the analysed surface`
    );
  }

  let lockfiles: {base: LockfileIndex; head: LockfileIndex} | undefined;
  for (const path of lockfileChanges) {
    const base = readBaseFile(path);
    const absolute = join(repoRoot, path);
    if (base === undefined || !existsSync(absolute)) {
      globalReasons.push(`${path} could not be compared against the base revision`);
      continue;
    }
    try {
      lockfiles = {
        base: parseLockfile(base),
        head: parseLockfile(readFileSync(absolute, "utf8")),
      };
    } catch {
      globalReasons.push(`${path} could not be parsed`);
    }
  }

  return {
    changedFiles: normalized,
    shards: contexts.map((context) => {
      const reasons = [...globalReasons];
      if (context.graph.unresolved) {
        reasons.push("import graph has unresolved modules");
      }
      for (const path of sourceChanges) {
        const reason = decideSourceFile({
          context,
          path,
          readBaseFile,
          repoRoot,
          workspacePackages,
        });
        if (reason) {
          reasons.push(reason);
        }
      }
      if (lockfiles) {
        const changed = changedRuntimeDependencies({
          baseLockfile: lockfiles.base,
          headLockfile: lockfiles.head,
          roots: context.graph.externalPackages,
        });
        if (changed.length > 0) {
          reasons.push(
            `bun.lock changed installs the app depends on: ${changed.slice(0, 5).join(", ")}`
          );
        }
      }
      return {affected: reasons.length > 0, name: context.shard.name, reasons};
    }),
  };
};
