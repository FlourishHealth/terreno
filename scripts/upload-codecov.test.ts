import {describe, it} from "bun:test";
import {spawnSync} from "node:child_process";
import {mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {assert} from "chai";

const script = join(import.meta.dir, "upload-codecov.sh");

describe("upload-codecov.sh", () => {
  it("exits 1 without a flag", () => {
    const result = spawnSync("bash", [script], {encoding: "utf8"});
    assert.equal(result.status, 1);
    assert.include(result.stderr, "usage:");
  });

  it("skips when lcov.info is missing", () => {
    const result = spawnSync("bash", [script, "api"], {
      cwd: mkdtempSync(join(tmpdir(), "codecov-")),
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.include(result.stdout, "skipping Codecov upload");
  });

  it("skips when CODECOV_TOKEN is unset", () => {
    const dir = mkdtempSync(join(tmpdir(), "codecov-"));
    writeFileSync(join(dir, "lcov.info"), "SF:src/a.ts\nDA:1,1\nend_of_record\n");
    const env = {...process.env};
    delete env.CODECOV_TOKEN;
    const result = spawnSync("bash", [script, "api", "lcov.info"], {
      cwd: dir,
      encoding: "utf8",
      env,
    });
    assert.equal(result.status, 0);
    assert.include(result.stdout, "CODECOV_TOKEN unset");
  });
});
