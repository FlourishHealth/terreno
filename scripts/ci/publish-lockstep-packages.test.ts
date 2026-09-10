import {describe, it} from "bun:test";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {assert} from "chai";

import {PUBLISHED_PACKAGES} from "../check-license-coverage/lib";

const repoRoot = join(import.meta.dir, "../..");
const circleConfig = readFileSync(join(repoRoot, ".circleci/continue-config.yml"), "utf8");
const publishWorkflow = readFileSync(
  join(repoRoot, ".github/workflows/publish-on-tag.yml"),
  "utf8"
);
const changelog = readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8");
const changelogFragment = readFileSync(
  join(repoRoot, "changelog/unreleased/create-terreno-app.md"),
  "utf8"
);
const dogfoodSkill = readFileSync(
  join(repoRoot, ".rulesync/skills/build-terreno-app/SKILL.md"),
  "utf8"
);

describe("lockstep publish package lists", () => {
  it("includes create-terreno-app in CircleCI tag publish and master version bump", () => {
    assert.match(
      circleConfig,
      /packages=\(\s*\n\s*api test ui rtk admin-backend admin-frontend admin-spa ai\s*\n\s*api-health comms feature-flags create-terreno-app mcp-server syncdb\s*\n\s*\)/
    );
    assert.match(
      circleConfig,
      /for package in api test ui rtk admin-backend admin-frontend admin-spa ai api-health comms feature-flags create-terreno-app mcp-server syncdb; do/
    );
  });

  it("includes create-terreno-app in GitHub tag publish fallback workflow", () => {
    assert.match(publishWorkflow, /publish-create-terreno-app:/);
    assert.match(publishWorkflow, /needs\.publish-create-terreno-app\.result/);
    assert.match(
      publishWorkflow,
      /update_version create-terreno-app "\$\{\{ needs\.publish-create-terreno-app\.result \}\}"/
    );
    assert.match(publishWorkflow, /add_status "create-terreno-app"/);
    assert.match(
      publishWorkflow,
      /needs: \[check-changes, publish-api, publish-test, publish-create-terreno-app\]/,
      "publish-mcp must wait for create-terreno-app because it depends on it at publish time"
    );
    assert.match(
      publishWorkflow,
      /publish-create-terreno-app:[\s\S]*?working-directory: create-terreno-app/
    );
    assert.match(
      publishWorkflow,
      /publish-mcp:[\s\S]*?key\.startsWith\('@terreno\/'\) \|\| key === 'create-terreno-app'/
    );
    assert.match(
      publishWorkflow,
      /update-version-on-master:[\s\S]*?needs: \[[^\]]*publish-create-terreno-app/
    );
    assert.match(
      publishWorkflow,
      /update-version-on-master:[\s\S]*?needs\.publish-create-terreno-app\.result == 'success'/
    );
    assert.match(publishWorkflow, /notify:[\s\S]*?needs: \[[^\]]*publish-create-terreno-app/);
  });

  it("covers license, changelog, and dogfood contracts", () => {
    assert.include([...PUBLISHED_PACKAGES], "create-terreno-app");
    assert.match(changelog, /unscoped `create-terreno-app` CLI are versioned in lockstep/);
    assert.match(changelogFragment, /^---\ncategory: Added\n---/);
    assert.match(changelogFragment, /create-terreno-app/);
    assert.match(dogfoodSkill, /### Phase 2 — Scaffold[\s\S]*bunx create-terreno-app/);
    assert.match(dogfoodSkill, /file dump as fallback/);
  });
});
