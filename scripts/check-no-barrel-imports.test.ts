import {expect, test} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {collectBarrelImportViolations} from "./check-no-barrel-imports";

const createFixtureRepo = (): string => {
  const root = mkdtempSync(join(tmpdir(), "terreno-barrel-check-"));

  mkdirSync(join(root, "example-backend/src/models"), {recursive: true});
  mkdirSync(join(root, "example-backend/src/api"), {recursive: true});
  mkdirSync(join(root, "ui/src/icons"), {recursive: true});
  writeFileSync(
    join(root, "example-backend/src/models/index.ts"),
    'export * from "./user";\n'
  );
  writeFileSync(join(root, "example-backend/src/models/user.ts"), "export const User = 1;\n");
  writeFileSync(
    join(root, "example-backend/src/api/users.ts"),
    'import {User} from "../models";\nexport const users = User;\n'
  );
  writeFileSync(
    join(root, "ui/src/icons/index.ts"),
    'export * from "./SparklesIcon";\n'
  );
  writeFileSync(
    join(root, "ui/src/icons/SparklesIcon.tsx"),
    "export const SparklesIcon = () => null;\n"
  );
  writeFileSync(
    join(root, "ui/src/Widget.tsx"),
    'import {SparklesIcon} from "./icons";\nexport const Widget = SparklesIcon;\n'
  );

  return root;
};

test("collectBarrelImportViolations flags directory imports that resolve to barrel index files", () => {
  const root = createFixtureRepo();

  try {
    const violations = collectBarrelImportViolations(root, [
      "example-backend/src",
      "ui/src",
    ]);

    expect(violations).toHaveLength(2);
    expect(violations[0]?.importPath).toBe("../models");
    expect(violations[1]?.importPath).toBe("./icons");
  } finally {
    rmSync(root, {force: true, recursive: true});
  }
});

test("collectBarrelImportViolations allows @terreno package public API imports", () => {
  const root = mkdtempSync(join(tmpdir(), "terreno-barrel-check-"));
  const apiSrc = join(root, "api/src");

  try {
    mkdirSync(join(root, "api/src"), {recursive: true});
    mkdirSync(join(root, "example-backend/src"), {recursive: true});
    writeFileSync(join(apiSrc, "index.ts"), 'export * from "./logger";\n');
    writeFileSync(join(apiSrc, "logger.ts"), "export const logger = {};\n");
    writeFileSync(
      join(root, "example-backend/src/server.ts"),
      'import {logger} from "@terreno/api";\nexport const run = () => logger;\n'
    );

    const violations = collectBarrelImportViolations(root, ["example-backend/src"]);
    expect(violations).toHaveLength(0);
  } finally {
    rmSync(root, {force: true, recursive: true});
  }
});
