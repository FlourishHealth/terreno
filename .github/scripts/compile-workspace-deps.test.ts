import {describe, it} from "bun:test";
import {createRequire} from "node:module";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import {assert} from "chai";

const require = createRequire(import.meta.url);
const {compileCommandForDir} = require("./compile-workspace-deps.js") as {
  compileCommandForDir: (dir: string) => string;
};

const thisDir = dirname(fileURLToPath(import.meta.url));

describe("compileCommandForDir", () => {
  it("uses tsconfig.server.json when that file exists", (): void => {
    const dir = mkdtempSync(join(tmpdir(), "compile-workspace-deps-"));
    try {
      writeFileSync(join(dir, "tsconfig.server.json"), "{}");
      assert.equal(compileCommandForDir(dir), "bun tsc -p tsconfig.server.json");
    } finally {
      rmSync(dir, {force: true, recursive: true});
    }
  });

  it("uses bun tsc when there is no server tsconfig", (): void => {
    const dir = mkdtempSync(join(tmpdir(), "compile-workspace-deps-"));
    try {
      assert.equal(compileCommandForDir(dir), "bun tsc");
    } finally {
      rmSync(dir, {force: true, recursive: true});
    }
  });

  it("compiles admin-spa with the server tsconfig", (): void => {
    assert.equal(
      compileCommandForDir(join(thisDir, "../../admin-spa")),
      "bun tsc -p tsconfig.server.json"
    );
  });
});
