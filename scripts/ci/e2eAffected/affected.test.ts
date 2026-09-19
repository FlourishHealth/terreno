import {describe, it} from "bun:test";
import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {assert} from "chai";

import {computeAffected, expandRootPatterns} from "./affected";
import type {ShardDefinition} from "./shards";

const SHARD: ShardDefinition = {
  blocksPullRequest: true,
  name: "app",
  routes: ["app/screen.tsx"],
  specs: [],
};

const BASE_FILES: Record<string, string> = {
  "app/screen.tsx": 'import {Box} from "@x/ui";\nexport const Screen = Box;',
  "bun.lock": JSON.stringify({
    packages: {
      luxon: ["luxon@3.0.0", "", {}, "sha512-a"],
      pngjs: ["pngjs@3.4.0", "", {}, "sha512-b"],
    },
  }),
  "package.json": JSON.stringify({workspaces: ["ui"]}),
  "ui/package.json": JSON.stringify({exports: {".": {default: "./dist/index.js"}}, name: "@x/ui"}),
  "ui/src/Box.tsx": "export const Box = () => 1;",
  "ui/src/Chart.tsx": "export const Chart = () => 2;",
  "ui/src/index.tsx": ['export * from "./Box";', 'export * from "./Chart";'].join("\n"),
};

const createFixture = (overrides: Record<string, string> = {}): string => {
  const root = mkdtempSync(join(tmpdir(), "terreno-e2e-affected-"));
  for (const [path, contents] of Object.entries({...BASE_FILES, ...overrides})) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, ".."), {recursive: true});
    writeFileSync(absolute, contents);
  }
  return root;
};

const decide = ({
  changedFiles,
  repoRoot,
}: {
  changedFiles: string[];
  repoRoot: string;
}): {affected: boolean; reasons: string[]} => {
  const result = computeAffected({
    changedFiles,
    readBaseFile: (path) => BASE_FILES[path],
    repoRoot,
    rootPatternsFor: ({shard}) => shard.routes,
    shards: [SHARD],
  });
  const shard = result.shards[0];
  return {affected: shard?.affected ?? true, reasons: shard?.reasons ?? []};
};

describe("computeAffected", () => {
  it("runs the shard when a reachable module changes", () => {
    const repoRoot = createFixture({"ui/src/Box.tsx": "export const Box = () => 99;"});
    assert.isTrue(decide({changedFiles: ["ui/src/Box.tsx"], repoRoot}).affected);
  });

  it("skips the shard when an unreachable module changes", () => {
    const repoRoot = createFixture({"ui/src/Chart.tsx": "export const Chart = () => 99;"});
    assert.isFalse(decide({changedFiles: ["ui/src/Chart.tsx"], repoRoot}).affected);
  });

  it("skips a barrel that only gained a re-export nothing imports", () => {
    const repoRoot = createFixture({
      "ui/src/index.tsx": [
        'export * from "./Box";',
        'export * from "./Chart";',
        'export * from "./New";',
      ].join("\n"),
      "ui/src/New.tsx": "export const New = () => 3;",
    });
    assert.isFalse(
      decide({changedFiles: ["ui/src/index.tsx", "ui/src/New.tsx"], repoRoot}).affected
    );
  });

  it("runs the shard when a barrel repoints an imported binding", () => {
    const repoRoot = createFixture({
      "ui/src/index.tsx": ['export {Chart as Box} from "./Chart";'].join("\n"),
    });
    assert.isTrue(decide({changedFiles: ["ui/src/index.tsx"], repoRoot}).affected);
  });

  it("skips documentation and test changes", () => {
    const repoRoot = createFixture();
    assert.isFalse(
      decide({changedFiles: ["docs/how-to/x.md", "ui/src/Box.test.tsx", "demo/app.tsx"], repoRoot})
        .affected
    );
  });

  it("runs every shard when the gate itself changes", () => {
    const repoRoot = createFixture();
    const {affected, reasons} = decide({
      changedFiles: ["scripts/ci/e2eAffected/affected.ts"],
      repoRoot,
    });
    assert.isTrue(affected);
    assert.match(reasons[0] ?? "", /changes this gate/);
  });

  it("runs the shard for a file outside the analysed surface", () => {
    const repoRoot = createFixture();
    const {affected, reasons} = decide({
      changedFiles: ["example-frontend/metro.config.js"],
      repoRoot,
    });
    assert.isTrue(affected);
    assert.match(reasons[0] ?? "", /outside the analysed surface/);
  });

  it("skips a package.json that only changed dependency ranges", () => {
    const repoRoot = createFixture({
      "ui/package.json": JSON.stringify({
        dependencies: {"d3-shape": "^3.2.0"},
        exports: {".": {default: "./dist/index.js"}},
        name: "@x/ui",
      }),
    });
    assert.isFalse(decide({changedFiles: ["ui/package.json"], repoRoot}).affected);
  });

  it("runs the shard when a lockfile install the app imports changes", () => {
    const repoRoot = createFixture({
      "app/screen.tsx": 'import {DateTime} from "luxon";\nexport const Screen = DateTime;',
      "bun.lock": JSON.stringify({
        packages: {
          luxon: ["luxon@3.1.0", "", {}, "sha512-a"],
          pngjs: ["pngjs@3.4.0", "", {}, "sha512-b"],
        },
      }),
    });
    const {affected, reasons} = decide({changedFiles: ["bun.lock"], repoRoot});
    assert.isTrue(affected);
    assert.match(reasons[0] ?? "", /luxon@3\.1\.0/);
  });

  it("skips a lockfile change the app never installs", () => {
    const repoRoot = createFixture({
      "bun.lock": JSON.stringify({
        packages: {
          luxon: ["luxon@3.0.0", "", {}, "sha512-a"],
          pngjs: ["pngjs@7.0.0", "", {}, "sha512-c"],
        },
      }),
    });
    assert.isFalse(decide({changedFiles: ["bun.lock"], repoRoot}).affected);
  });
});

describe("expandRootPatterns", () => {
  it("expands directory globs to source files", () => {
    const repoRoot = createFixture();
    assert.deepEqual(expandRootPatterns({patterns: ["ui/src/**"], repoRoot}).sort(), [
      join(repoRoot, "ui/src/Box.tsx"),
      join(repoRoot, "ui/src/Chart.tsx"),
      join(repoRoot, "ui/src/index.tsx"),
    ]);
  });
});
