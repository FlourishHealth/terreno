import {existsSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEBSITE_ROOT = resolve(SCRIPT_DIR, "..");
const KEEP_VERSION_COUNT = 4;

export const parseVersionLabel = (label: string): number[] =>
  label
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));

export const compareVersions = (a: string, b: string): number => {
  const aParts = parseVersionLabel(a);
  const bParts = parseVersionLabel(b);
  const length = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < length; index += 1) {
    const aValue = aParts[index] ?? 0;
    const bValue = bParts[index] ?? 0;
    if (aValue !== bValue) {
      return bValue - aValue;
    }
  }
  return 0;
};

/**
 * Docusaurus stores `versions.json` as a JSON array of version-label strings,
 * newest first. Drop anything that is not a non-empty string so a previously
 * corrupted file (e.g. a `null` hole left by an older buggy prune) self-heals.
 */
const readVersions = (versionsFile: string): string[] => {
  const parsed = JSON.parse(readFileSync(versionsFile, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected ${versionsFile} to contain a JSON array of version strings.`);
  }
  return parsed.filter((label): label is string => typeof label === "string" && label.length > 0);
};

export interface PruneOptions {
  websiteRoot?: string;
  keepCount?: number;
}

export const pruneDocVersions = ({
  websiteRoot = DEFAULT_WEBSITE_ROOT,
  keepCount = KEEP_VERSION_COUNT,
}: PruneOptions = {}): void => {
  const versionsFile = join(websiteRoot, "versions.json");
  const versionedDocsDir = join(websiteRoot, "versioned_docs");
  const versionedSidebarsDir = join(websiteRoot, "versioned_sidebars");

  if (!existsSync(versionsFile)) {
    console.info("No versions.json found — nothing to prune.");
    return;
  }

  const versions = readVersions(versionsFile);
  const sorted = [...versions].sort(compareVersions);
  const remaining = sorted.slice(0, keepCount);
  const toRemove = sorted.slice(keepCount);

  // Always rewrite so a corrupted (non-string entry) versions.json is repaired,
  // even when there is nothing to prune.
  writeFileSync(versionsFile, `${JSON.stringify(remaining, null, 2)}\n`);

  if (toRemove.length === 0) {
    console.info("No doc versions to prune.");
  } else {
    for (const label of toRemove) {
      const versionDir = join(versionedDocsDir, `version-${label}`);
      if (existsSync(versionDir)) {
        rmSync(versionDir, {force: true, recursive: true});
      }
      const sidebarFile = join(versionedSidebarsDir, `version-${label}-sidebars.json`);
      if (existsSync(sidebarFile)) {
        rmSync(sidebarFile, {force: true});
      }
      console.info(`Pruned docs version ${label}`);
    }
  }

  if (existsSync(versionedDocsDir)) {
    const remainingDirs = readdirSync(versionedDocsDir);
    console.info(`Remaining versioned_docs entries: ${remainingDirs.join(", ")}`);
  }
};

if (import.meta.main) {
  pruneDocVersions();
}
