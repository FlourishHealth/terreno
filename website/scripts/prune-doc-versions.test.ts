import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {compareVersions, pruneDocVersions} from "./prune-doc-versions";

let websiteRoot: string;

const versionsFile = (): string => join(websiteRoot, "versions.json");

const seedVersion = (label: string): void => {
  mkdirSync(join(websiteRoot, "versioned_docs", `version-${label}`), {recursive: true});
  mkdirSync(join(websiteRoot, "versioned_sidebars"), {recursive: true});
  writeFileSync(join(websiteRoot, "versioned_sidebars", `version-${label}-sidebars.json`), "{}\n");
};

const seed = (versions: unknown[]): void => {
  mkdirSync(join(websiteRoot, "versioned_docs"), {recursive: true});
  for (const label of versions) {
    if (typeof label === "string" && label.length > 0) {
      seedVersion(label);
    }
  }
  writeFileSync(versionsFile(), `${JSON.stringify(versions, null, 2)}\n`);
};

const readVersionsFile = (): unknown[] =>
  JSON.parse(readFileSync(versionsFile(), "utf8")) as unknown[];

beforeEach(() => {
  websiteRoot = mkdtempSync(join(tmpdir(), "prune-doc-versions-"));
});

afterEach(() => {
  rmSync(websiteRoot, {force: true, recursive: true});
});

describe("prune-doc-versions helpers", () => {
  it("sorts semver labels descending", () => {
    const sorted = ["0.15.0", "0.18.0", "0.17.2", "0.17.0"].sort(compareVersions);
    expect(sorted).toEqual(["0.18.0", "0.17.2", "0.17.0", "0.15.0"]);
  });
});

describe("pruneDocVersions", () => {
  it("keeps the newest versions and prunes the oldest from the array", () => {
    seed(["0.24.0", "0.23.0", "0.21.0", "0.20.0", "0.19.0"]);

    pruneDocVersions({keepCount: 4, websiteRoot});

    expect(readVersionsFile()).toEqual(["0.24.0", "0.23.0", "0.21.0", "0.20.0"]);
    expect(existsSync(join(websiteRoot, "versioned_docs", "version-0.19.0"))).toBe(false);
    expect(
      existsSync(join(websiteRoot, "versioned_sidebars", "version-0.19.0-sidebars.json"))
    ).toBe(false);
    expect(existsSync(join(websiteRoot, "versioned_docs", "version-0.24.0"))).toBe(true);
  });

  it("never writes a null hole for the newest version", () => {
    seed(["0.24.0", "0.23.0", "0.21.0", "0.20.0", "0.19.0"]);

    pruneDocVersions({keepCount: 4, websiteRoot});

    expect(readVersionsFile()).not.toContain(null);
    expect(readVersionsFile()[0]).toBe("0.24.0");
  });

  it("self-heals a corrupted versions.json containing a null hole", () => {
    seed([null, "0.23.0", "0.21.0", "0.20.0", "0.19.0"]);

    pruneDocVersions({keepCount: 4, websiteRoot});

    expect(readVersionsFile()).toEqual(["0.23.0", "0.21.0", "0.20.0", "0.19.0"]);
    expect(readVersionsFile()).not.toContain(null);
  });

  it("leaves the list intact when at or below the keep count", () => {
    seed(["0.23.0", "0.21.0", "0.20.0", "0.19.0"]);

    pruneDocVersions({keepCount: 4, websiteRoot});

    expect(readVersionsFile()).toEqual(["0.23.0", "0.21.0", "0.20.0", "0.19.0"]);
    expect(existsSync(join(websiteRoot, "versioned_docs", "version-0.19.0"))).toBe(true);
  });
});
