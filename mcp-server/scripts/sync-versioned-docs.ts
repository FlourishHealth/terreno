import {cpSync, existsSync, mkdirSync, readdirSync, rmSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const MCP_ROOT = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(MCP_ROOT, "..");
const WEBSITE_DIR = join(REPO_ROOT, "website");
const OUTPUT_DIR = join(MCP_ROOT, "src/docs/versioned");

const copyDirectory = (source: string, destination: string): void => {
  if (!existsSync(source)) {
    return;
  }
  rmSync(destination, {recursive: true, force: true});
  mkdirSync(destination, {recursive: true});
  cpSync(source, destination, {recursive: true});
};

const main = (): void => {
  rmSync(OUTPUT_DIR, {recursive: true, force: true});
  mkdirSync(OUTPUT_DIR, {recursive: true});

  copyDirectory(join(REPO_ROOT, "docs"), join(OUTPUT_DIR, "next"));

  const versionedDocsDir = join(WEBSITE_DIR, "versioned_docs");
  if (!existsSync(versionedDocsDir)) {
    console.info("No versioned_docs directory yet — synced next docs only.");
    return;
  }

  for (const entry of readdirSync(versionedDocsDir)) {
    if (!entry.startsWith("version-")) {
      continue;
    }
    const version = entry.replace(/^version-/, "");
    copyDirectory(join(versionedDocsDir, entry), join(OUTPUT_DIR, version));
    console.info(`Synced docs version ${version}`);
  }
};

main();
