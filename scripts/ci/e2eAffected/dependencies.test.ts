import {describe, it} from "bun:test";
import {assert} from "chai";

import {
  changedRuntimeDependencies,
  isManifestChangeMaterial,
  parseLockfile,
  reachableResolutions,
  resolveLockfileKey,
} from "./dependencies";

const lockfile = ({
  hoistedPngjs,
  nestedPngjs,
}: {
  hoistedPngjs: string;
  nestedPngjs?: string;
}): string =>
  `${JSON.stringify(
    {
      lockfileVersion: 1,
      packages: {
        expo: ["expo@52.0.0", "", {dependencies: {"parse-png": "^2.1.0"}}, "sha512-a"],
        "parse-png": ["parse-png@2.1.0", "", {dependencies: {pngjs: "^3.4.0"}}, "sha512-b"],
        pngjs: [`pngjs@${hoistedPngjs}`, "", {}, "sha512-c"],
        ...(nestedPngjs ? {"parse-png/pngjs": [`pngjs@${nestedPngjs}`, "", {}, "sha512-d"]} : {}),
      },
    },
    null,
    2
  )}\n`;

describe("parseLockfile", () => {
  it("indexes installs by lockfile key with their resolution", () => {
    const parsed = parseLockfile(lockfile({hoistedPngjs: "3.4.0"}));
    assert.equal(parsed["parse-png"]?.name, "parse-png");
    assert.equal(parsed["parse-png"]?.resolution, "parse-png@2.1.0");
    assert.deepEqual(parsed["parse-png"]?.dependencies, ["pngjs"]);
  });

  it("accepts trailing commas", () => {
    const parsed = parseLockfile('{"packages": {"a": ["a@1.0.0", "", {}, "sha"],},}');
    assert.equal(parsed.a?.resolution, "a@1.0.0");
  });
});

describe("resolveLockfileKey", () => {
  it("prefers a nested install over the hoisted one", () => {
    const parsed = parseLockfile(lockfile({hoistedPngjs: "7.0.0", nestedPngjs: "3.4.0"}));
    assert.equal(
      resolveLockfileKey({dependency: "pngjs", lockfile: parsed, parentKey: "parse-png"}),
      "parse-png/pngjs"
    );
  });
});

describe("reachableResolutions", () => {
  it("walks transitive dependencies from the imported packages", () => {
    const parsed = parseLockfile(lockfile({hoistedPngjs: "3.4.0"}));
    assert.deepEqual([...reachableResolutions({lockfile: parsed, roots: ["expo"]})].sort(), [
      "expo@52.0.0",
      "parse-png@2.1.0",
      "pngjs@3.4.0",
    ]);
  });
});

describe("changedRuntimeDependencies", () => {
  it("ignores a hoisting change that keeps the same installed version", () => {
    assert.deepEqual(
      changedRuntimeDependencies({
        baseLockfile: parseLockfile(lockfile({hoistedPngjs: "3.4.0"})),
        headLockfile: parseLockfile(lockfile({hoistedPngjs: "7.0.0", nestedPngjs: "3.4.0"})),
        roots: ["expo"],
      }),
      []
    );
  });

  it("reports a version change the app actually installs", () => {
    assert.deepEqual(
      changedRuntimeDependencies({
        baseLockfile: parseLockfile(lockfile({hoistedPngjs: "3.4.0"})),
        headLockfile: parseLockfile(lockfile({hoistedPngjs: "3.5.0"})),
        roots: ["expo"],
      }),
      ["pngjs@3.4.0", "pngjs@3.5.0"]
    );
  });

  it("ignores packages nothing in the app imports", () => {
    assert.deepEqual(
      changedRuntimeDependencies({
        baseLockfile: parseLockfile(lockfile({hoistedPngjs: "3.4.0"})),
        headLockfile: parseLockfile(lockfile({hoistedPngjs: "7.0.0"})),
        roots: ["luxon"],
      }),
      []
    );
  });
});

describe("isManifestChangeMaterial", () => {
  const manifest = (extra: Record<string, unknown>): string =>
    JSON.stringify({name: "@x/ui", version: "1.0.0", ...extra});

  it("ignores dependency, script, and version edits", () => {
    assert.isFalse(
      isManifestChangeMaterial({
        base: manifest({dependencies: {luxon: "^3.0.0"}, scripts: {build: "tsc"}}),
        head: manifest({dependencies: {d3: "^1.0.0", luxon: "^3.1.0"}, scripts: {build: "tsc -b"}}),
      })
    );
  });

  it("flags an entry point change", () => {
    assert.isTrue(
      isManifestChangeMaterial({
        base: manifest({main: "dist/index.js"}),
        head: manifest({main: "dist/other.js"}),
      })
    );
  });

  it("fails open on unparseable manifests", () => {
    assert.isTrue(isManifestChangeMaterial({base: "{", head: manifest({})}));
  });
});
