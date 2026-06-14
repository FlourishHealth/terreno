import {existsSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEBSITE_ROOT = resolve(SCRIPT_DIR, "..");
const VERSIONED_DOCS_DIR = join(WEBSITE_ROOT, "versioned_docs");
const VERSIONS_FILE = join(WEBSITE_ROOT, "versions.json");
const KEEP_VERSION_COUNT = 4;

interface VersionsJson {
  [label: string]: {
    label: string;
  };
}

const parseVersionLabel = (label: string): number[] =>
  label
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));

const compareVersions = (a: string, b: string): number => {
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

const main = (): void => {
  if (!existsSync(VERSIONS_FILE)) {
    console.info("No versions.json found — nothing to prune.");
    return;
  }

  const versions = JSON.parse(readFileSync(VERSIONS_FILE, "utf8")) as VersionsJson;
  const labels = Object.keys(versions).filter((label) => label !== "next");
  const sorted = labels.sort(compareVersions);
  const toRemove = sorted.slice(KEEP_VERSION_COUNT);

  if (toRemove.length === 0) {
    console.info("No doc versions to prune.");
    return;
  }

  for (const label of toRemove) {
    const versionDir = join(VERSIONED_DOCS_DIR, `version-${label}`);
    if (existsSync(versionDir)) {
      rmSync(versionDir, {force: true, recursive: true});
    }
    const sidebarFile = join(WEBSITE_ROOT, "versioned_sidebars", `version-${label}-sidebars.json`);
    if (existsSync(sidebarFile)) {
      rmSync(sidebarFile, {force: true});
    }
    delete versions[label];
    console.info(`Pruned docs version ${label}`);
  }

  writeFileSync(VERSIONS_FILE, `${JSON.stringify(versions, null, 2)}\n`);

  const remaining = readdirSync(VERSIONED_DOCS_DIR);
  console.info(`Remaining versioned_docs entries: ${remaining.join(", ")}`);
};

main();
