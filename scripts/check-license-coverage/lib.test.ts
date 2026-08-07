import {expect, test} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {checkLicenseCoverage} from "./lib";

const createRepoFixture = (): string => {
  const repoRoot = mkdtempSync(join(tmpdir(), "license-check-"));

  writeFileSync(
    join(repoRoot, "package.json"),
    JSON.stringify({license: "MIT"}, null, 2),
  );

  mkdirSync(join(repoRoot, "api"), {recursive: true});
  writeFileSync(join(repoRoot, "api", "LICENSE"), "MIT");
  writeFileSync(
    join(repoRoot, "api", "package.json"),
    JSON.stringify({license: "MIT"}, null, 2),
  );

  return repoRoot;
};

test("checkLicenseCoverage passes when LICENSE and license field match root", () => {
  const repoRoot = createRepoFixture();

  try {
    const failures = checkLicenseCoverage({
      repoRoot,
      publishedPackages: ["api"],
    });

    expect(failures).toEqual([]);
  } finally {
    rmSync(repoRoot, {force: true, recursive: true});
  }
});

test("checkLicenseCoverage fails when LICENSE file is missing", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "license-check-"));

  try {
    mkdirSync(join(repoRoot, "api"), {recursive: true});
    writeFileSync(
      join(repoRoot, "package.json"),
      JSON.stringify({license: "MIT"}, null, 2),
    );
    writeFileSync(
      join(repoRoot, "api", "package.json"),
      JSON.stringify({license: "MIT"}, null, 2),
    );

    const failures = checkLicenseCoverage({
      repoRoot,
      publishedPackages: ["api"],
    });

    expect(failures).toEqual([
      {
        packageDir: "api",
        message: "missing LICENSE file",
      },
    ]);
  } finally {
    rmSync(repoRoot, {force: true, recursive: true});
  }
});

test("checkLicenseCoverage fails when files array omits LICENSE", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "license-check-"));

  try {
    mkdirSync(join(repoRoot, "ui"), {recursive: true});
    writeFileSync(
      join(repoRoot, "package.json"),
      JSON.stringify({license: "MIT"}, null, 2),
    );
    writeFileSync(join(repoRoot, "ui", "LICENSE"), "MIT");
    writeFileSync(
      join(repoRoot, "ui", "package.json"),
      JSON.stringify({license: "MIT", files: ["dist/**/*"]}, null, 2),
    );

    const failures = checkLicenseCoverage({
      repoRoot,
      publishedPackages: ["ui"],
    });

    expect(failures).toEqual([
      {
        packageDir: "ui",
        message: 'package.json files array does not include "LICENSE"',
      },
    ]);
  } finally {
    rmSync(repoRoot, {force: true, recursive: true});
  }
});
