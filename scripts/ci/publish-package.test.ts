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
});
