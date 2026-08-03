import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {join} from "node:path";
import {describe, it} from "bun:test";

const repoRoot = join(import.meta.dir, "..");

const readRepoFile = (path: string): string =>
  readFileSync(join(repoRoot, path), "utf8");

const buildWorkflowPaths = [
  "example-frontend/.eas/workflows/example-frontend-build.yml",
  "example-frontend/.eas/workflows/ios-device-build.yml",
  "demo/.eas/workflows/demo-build.yml",
  "demo/.eas/workflows/ios-device-build.yml",
];

describe("EAS PR workflows", () => {
  it("publishes PR updates directly from GitHub Actions", () => {
    const easPr = readRepoFile(".github/workflows/eas-pr.yml");

    assert.doesNotMatch(easPr, /example-frontend-update\.yml/);
    assert.doesNotMatch(easPr, /demo-update\.yml/);
    assert.match(easPr, /eas update\s+\\\n\s+--branch "pr-\$\{PR_NUMBER\}"/);
    assert.match(easPr, /--message "PR #\$\{PR_NUMBER\}: \$\{PR_TITLE\}"/);
    assert.match(easPr, /EAS_UPDATE_GROUP_ID=\$\{first_id\}/);
    assert.match(easPr, /eas-pr-decide\.sh/);
    assert.match(easPr, /eas-pr-selective-build\.sh/);
    assert.match(
      easPr,
      /Slow path — queue builds for new fingerprint only[\s\S]*eas-pr-selective-build\.sh/
    );
    assert.match(
      easPr,
      /if: \$\{\{ !cancelled\(\) && steps\.decide\.outputs\.needs_build == 'true' \}\}/
    );
    assert.doesNotMatch(easPr, /-F "pr_number=/);
    assert.doesNotMatch(easPr, /-F "pr_title=/);
  });

  it("wires decide outputs to the dispatch and comment steps", () => {
    const easPr = readRepoFile(".github/workflows/eas-pr.yml");

    // The comment reports finished builds; dispatch consumes coverage flags.
    assert.match(easPr, /IOS_DEVICE_MATCH: \$\{\{ steps\.decide\.outputs\.ios_device_finished \}\}/);
    assert.match(easPr, /ANDROID_MATCH: \$\{\{ steps\.decide\.outputs\.android_finished \}\}/);
    assert.match(easPr, /IOS_DEVICE_QUEUED: \$\{\{ steps\.decide\.outputs\.ios_device_queued \}\}/);
    assert.match(easPr, /IOS_DEVICE_MATCH: \$\{\{ steps\.decide\.outputs\.ios_device_match \}\}/);
  });

  it("distinguishes a missing platform from a queued rebuild in the comment", () => {
    const commentScript = readRepoFile(
      ".github/workflows/scripts/post-eas-pr-comment.sh"
    );

    assert.match(commentScript, /New fingerprint — build queued/);
    assert.match(commentScript, /No finished build for this fingerprint yet/);
    assert.match(commentScript, /IOS_DEVICE_QUEUED:-false/);
  });

  it("dispatches iOS device builds via EAS workflow for credentials", () => {
    const selective = readRepoFile(
      ".github/workflows/scripts/eas-pr-selective-build.sh"
    );

    assert.match(selective, /eas workflow:run "\$IOS_DEVICE_WORKFLOW"/);
    assert.match(selective, /ios-device-build\.yml/);
    assert.match(
      selective,
      /eas build --profile "\$IOS_SIM_PROFILE" --platform ios/
    );
    assert.match(
      selective,
      /eas build --profile "\$ANDROID_PROFILE" --platform android/
    );
    assert.doesNotMatch(
      selective,
      /eas build --profile "\$IOS_DEVICE_PROFILE" --platform ios/
    );
  });

  it("keeps EAS Cloud workflows build-only", () => {
    for (const workflowPath of buildWorkflowPaths) {
      const workflow = readRepoFile(workflowPath);

      assert.match(workflow, /type:\s*build/);
      assert.doesNotMatch(workflow, /eas-cli@latest update/);
      assert.doesNotMatch(workflow, /--branch "pr-/);
      assert.doesNotMatch(workflow, /inputs\.pr_number/);
      assert.doesNotMatch(workflow, /inputs\.pr_title/);
    }
  });

  it("keeps manual build dispatch from passing PR update inputs", () => {
    const manualDispatch = readRepoFile(".github/workflows/eas-dev-build.yml");

    assert.match(manualDispatch, /eas workflow:run "\.eas\/workflows\/\$file"/);
    assert.match(manualDispatch, /bun install --frozen-lockfile/);
    assert.doesNotMatch(manualDispatch, /pr_number/);
    assert.doesNotMatch(manualDispatch, /pr_title/);
  });

  it("uses EAS Update group URLs in PR launch links", () => {
    const commentScript = readRepoFile(
      ".github/workflows/scripts/post-eas-pr-comment.sh"
    );

    assert.match(commentScript, /\/group\/\$EAS_UPDATE_GROUP_ID/);
    assert.doesNotMatch(commentScript, /channel-name=\$branch/);
  });
});
