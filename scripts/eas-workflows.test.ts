import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {join} from "node:path";
import {describe, it} from "bun:test";

const repoRoot = join(import.meta.dir, "..");

const readRepoFile = (path: string): string =>
  readFileSync(join(repoRoot, path), "utf8");

const buildWorkflowPaths = [
  "example-frontend/.eas/workflows/example-frontend-build.yml",
  "demo/.eas/workflows/demo-build.yml",
];

describe("EAS PR workflows", () => {
  it("publishes PR updates directly from GitHub Actions", () => {
    const easPr = readRepoFile(".github/workflows/eas-pr.yml");

    assert.doesNotMatch(easPr, /example-frontend-update\.yml/);
    assert.doesNotMatch(easPr, /demo-update\.yml/);
    assert.match(easPr, /eas update\s+\\\n\s+--branch "pr-\$\{PR_NUMBER\}"/);
    assert.match(easPr, /--message "PR #\$\{PR_NUMBER\}: \$\{PR_TITLE\}"/);
    assert.match(easPr, /Slow path — dispatch EAS workflow async[\s\S]*example-frontend-build\.yml/);
    assert.match(easPr, /Slow path — dispatch EAS workflow async[\s\S]*demo-build\.yml/);
    assert.match(
      easPr,
      /if: \$\{\{ !cancelled\(\) && steps\.decide\.outputs\.needs_build == 'true' \}\}/
    );
    assert.doesNotMatch(easPr, /-F "pr_number=/);
    assert.doesNotMatch(easPr, /-F "pr_title=/);
  });

  it("keeps EAS Cloud workflows build-only", () => {
    for (const workflowPath of buildWorkflowPaths) {
      const workflow = readRepoFile(workflowPath);

      assert.match(workflow, /type:\s*build/);
      assert.match(workflow, /type:\s*get-build/);
      assert.doesNotMatch(workflow, /eas-cli@latest update/);
      assert.doesNotMatch(workflow, /--branch "pr-/);
      assert.doesNotMatch(workflow, /inputs\.pr_number/);
      assert.doesNotMatch(workflow, /inputs\.pr_title/);
    }
  });

  it("keeps manual build dispatch from passing PR update inputs", () => {
    const manualDispatch = readRepoFile(".github/workflows/eas-dev-build.yml");

    assert.match(manualDispatch, /eas workflow:run "\.eas\/workflows\/\$file"/);
    assert.doesNotMatch(manualDispatch, /pr_number/);
    assert.doesNotMatch(manualDispatch, /pr_title/);
  });
});
