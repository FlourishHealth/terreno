import {describe, it} from "bun:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const scriptPath = join(import.meta.dir, "publish-package.sh");
const script = readFileSync(scriptPath, "utf8");

describe("publish-package.sh", () => {
  it("does not bun install after pinning workspace versions to the unpublished tag", () => {
    const prepareMarker = "prepare-package-publish.mjs";
    const prepareIndex = script.indexOf(prepareMarker);
    assert.notEqual(prepareIndex, -1, "expected prepare-package-publish.mjs");
    const afterPrepare = script.slice(prepareIndex + prepareMarker.length);
    assert.doesNotMatch(
      afterPrepare,
      /\(cd "\$package_directory" && bun install\)/,
      "reinstall after pinning workspace:* looks for sibling @terreno packages on npm before they exist"
    );
  });

  it("runs test:ci before falling back to test so watch-mode scripts cannot hang publish", () => {
    const testCiIndex = script.indexOf("bun run test:ci");
    const testIndex = script.indexOf("bun run test)");
    assert.notEqual(testCiIndex, -1, "expected bun run test:ci");
    assert.notEqual(testIndex, -1, "expected bun run test fallback");
    assert.ok(
      testCiIndex < testIndex,
      "test:ci must run before test; ui's test script is bun test --watch"
    );
    assert.match(script, /pkg\.scripts\?\.\['test:ci'\]/, "expected test:ci script detection");
  });

  it("skips npm publish when the tag version is already on the registry", () => {
    assert.match(
      script,
      /Already on npm: \$\{package_name\}@\$\{version\}; skipping/,
      "retries of a partial tag publish must skip versions that already exist"
    );
    assert.match(
      script,
      /npm view "\$\{package_name\}@\$\{version\}" version/,
      "expected npm view guard"
    );
  });
});
