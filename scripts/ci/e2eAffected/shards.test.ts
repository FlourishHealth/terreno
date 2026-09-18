import {describe, it} from "bun:test";
import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {assert} from "chai";

import {expandRootPatterns} from "./affected";
import {parseGotoUrls, resolveExpoRoute} from "./expoRoutes";
import {isPassThroughBarrel} from "./moduleGraph";
import {E2E_SHARDS, rootPatternsForShard, specPathsForShard} from "./shards";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const APP_DIR = join(REPO_ROOT, "example-frontend", "app");
const CONTINUE_CONFIG = readFileSync(join(REPO_ROOT, ".circleci/continue-config.yml"), "utf8");

/** Shard groups as `run_example_frontend_e2e` expands them in CircleCI. */
const circleCiShardSpecs = (): Map<string, string[]> => {
  const groups = new Map<string, string[]>();
  for (const match of CONTINUE_CONFIG.matchAll(/^\s+([a-z-]+)\)\s+specs="([^"]+)"\s*;;$/gm)) {
    const [, name, specs] = match;
    if (name && specs) {
      groups.set(name, specs.split(/\s+/));
    }
  }
  return groups;
};

describe("e2e shard definitions", () => {
  it("matches the spec grouping in .circleci/continue-config.yml", () => {
    const groups = circleCiShardSpecs();
    for (const shard of E2E_SHARDS) {
      if (!shard.blocksPullRequest) {
        continue;
      }
      assert.deepEqual(groups.get(shard.name), shard.specs, shard.name);
    }
  });

  it("lists every Playwright spec exactly once", () => {
    const assigned = E2E_SHARDS.flatMap((shard) => shard.specs);
    assert.deepEqual([...new Set(assigned)].sort(), assigned.sort());
    const onDisk = [...new Bun.Glob("*.spec.ts").scanSync(join(REPO_ROOT, "example-frontend/e2e"))]
      .map((file) => file.replace(/\.spec\.ts$/, ""))
      .sort();
    assert.deepEqual(assigned.sort(), onDisk);
  });

  it("points at spec files that exist", () => {
    for (const shard of E2E_SHARDS) {
      for (const spec of specPathsForShard({shard})) {
        assert.isTrue(existsSync(join(REPO_ROOT, spec)), spec);
      }
    }
  });

  it("declares every screen its specs navigate to", () => {
    for (const shard of E2E_SHARDS) {
      const roots = new Set(
        expandRootPatterns({patterns: rootPatternsForShard({shard}), repoRoot: REPO_ROOT})
      );
      for (const spec of specPathsForShard({shard})) {
        for (const url of parseGotoUrls(readFileSync(join(REPO_ROOT, spec), "utf8"))) {
          const route = resolveExpoRoute({appDir: APP_DIR, url});
          assert.isDefined(route, `${spec} navigates to ${url}, which is not an Expo route`);
          assert.isTrue(
            roots.has(route as string),
            `${shard.name} must declare ${route} for ${url} in ${spec}`
          );
        }
      }
    }
  });
});

describe("repository assumptions the gate depends on", () => {
  it("keeps @terreno/ui's entry point a pass-through barrel", () => {
    // Runtime code in the barrel would make every ui change look reachable.
    assert.isTrue(isPassThroughBarrel(readFileSync(join(REPO_ROOT, "ui/src/index.tsx"), "utf8")));
  });
});
