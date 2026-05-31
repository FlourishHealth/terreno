import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {join} from "node:path";
import {describe, it} from "bun:test";

const repoRoot = join(import.meta.dir, "..");

const readRepoFile = (path: string): string =>
  readFileSync(join(repoRoot, path), "utf8");

const updateWorkflowPaths = [
  "example-frontend/.eas/workflows/example-frontend-update.yml",
  "demo/.eas/workflows/demo-update.yml",
];

const buildWorkflowPaths = [
  "example-frontend/.eas/workflows/example-frontend-build.yml",
  "demo/.eas/workflows/demo-build.yml",
];

describe("EAS PR workflows", () => {
  it("uses update-only workflows for fast-path PR updates", () => {
    const easPr = readRepoFile(".github/workflows/eas-pr.yml");

    assert.match(easPr, /eas workflow:run \.eas\/workflows\/example-frontend-update\.yml/);
    assert.match(easPr, /eas workflow:run \.eas\/workflows\/demo-update\.yml/);
    assert.match(easPr, /Slow path — dispatch EAS workflow async[\s\S]*example-frontend-build\.yml/);
    assert.match(easPr, /Slow path — dispatch EAS workflow async[\s\S]*demo-build\.yml/);
  });

  it("keeps update-only workflows from starting native build jobs", () => {
    for (const workflowPath of updateWorkflowPaths) {
      const workflow = readRepoFile(workflowPath);

      assert.doesNotMatch(workflow, /type:\s*build/);
      assert.doesNotMatch(workflow, /type:\s*get-build/);
      assert.doesNotMatch(workflow, /fingerprint_hash/);
      assert.match(workflow, /--branch "pr-\$\{PR_NUMBER\}"/);
      assert.match(workflow, /--message "PR #\$\{PR_NUMBER\}: \$\{PR_TITLE\}"/);
      assert.match(workflow, /EAS workflow inputs were not resolved/);
    }
  });

  it("keeps build-capable workflows guarded against unresolved PR templates", () => {
    for (const workflowPath of buildWorkflowPaths) {
      const workflow = readRepoFile(workflowPath);

      assert.match(workflow, /type:\s*build/);
      assert.match(workflow, /type:\s*get-build/);
      assert.match(workflow, /--branch "pr-\$\{PR_NUMBER\}"/);
      assert.match(workflow, /--message "PR #\$\{PR_NUMBER\}: \$\{PR_TITLE\}"/);
      assert.match(workflow, /EAS workflow inputs were not resolved/);
    }
  });
});
