import {strict as assert} from "node:assert";
import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, beforeEach, describe, it} from "bun:test";

const repoRoot = join(import.meta.dir, "..");
const decideScript = join(repoRoot, ".github/workflows/scripts/eas-pr-decide.sh");

const IOS_HASH = "iosaaaa1111";
const ANDROID_HASH = "androidbbbb2222";

/**
 * Stub `eas` CLI used to drive eas-pr-decide.sh without hitting EAS.
 *
 * `FAKE_BUILDS` is a comma-separated list of `platform|profile|status` tokens.
 * A fingerprint-scoped `build:list` returns one build when its
 * platform/profile/status triple is listed, and an empty array otherwise.
 * `build:list` without `--fingerprint-hash` (the install-link lookup) always
 * returns a placeholder id so link rendering stays exercised.
 */
const FAKE_EAS = `#!/usr/bin/env bash
set -euo pipefail

command="\${1:-}"
shift || true

if [ "$command" = "fingerprint:generate" ]; then
  platform=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --platform) platform="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  if [ "$platform" = "ios" ]; then
    echo '{"hash":"${IOS_HASH}"}'
  else
    echo '{"hash":"${ANDROID_HASH}"}'
  fi
  exit 0
fi

if [ "$command" = "build:list" ]; then
  platform=""; profile=""; status=""; hash=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --platform) platform="$2"; shift 2 ;;
      --profile) profile="$2"; shift 2 ;;
      --status) status="$2"; shift 2 ;;
      --fingerprint-hash) hash="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [ -z "$hash" ]; then
    echo '[{"id":"latest-'"$platform"'"}]'
    exit 0
  fi

  token="$platform|$profile|$status"
  if [[ ",\${FAKE_BUILDS:-}," == *",$token,"* ]]; then
    echo '[{"id":"match-'"$platform"'"}]'
  else
    echo '[]'
  fi
  exit 0
fi

echo "unexpected eas invocation: $command" >&2
exit 1
`;

let workDir: string;

/**
 * Runs eas-pr-decide.sh with the stub CLI on PATH and returns its
 * GITHUB_OUTPUT key/value pairs plus stdout, so tests can assert the
 * queueing decision rather than the presence of identifiers in the source.
 */
const runDecide = async (
  fakeBuilds: string[]
): Promise<{outputs: Record<string, string>; stdout: string}> => {
  const outputPath = join(workDir, "github-output");
  writeFileSync(outputPath, "");

  const result = Bun.spawnSync({
    cmd: ["bash", decideScript],
    env: {
      ...process.env,
      FAKE_BUILDS: fakeBuilds.join(","),
      GITHUB_OUTPUT: outputPath,
      PATH: `${workDir}:${process.env.PATH ?? ""}`,
    },
  });

  const stdout = result.stdout.toString();
  assert.equal(
    result.exitCode,
    0,
    `decide script failed: ${result.stderr.toString()}\n${stdout}`
  );

  const outputs: Record<string, string> = {};
  for (const line of (await Bun.file(outputPath).text()).split("\n")) {
    if (!line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    outputs[key] = rest.join("=");
  }
  return {outputs, stdout};
};

describe("eas-pr-decide.sh", () => {
  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "eas-decide-"));
    const easPath = join(workDir, "eas");
    writeFileSync(easPath, FAKE_EAS, {mode: 0o755});
  });

  afterEach(() => {
    rmSync(workDir, {force: true, recursive: true});
  });

  it("computes both fingerprints", async () => {
    const {outputs} = await runDecide([]);

    assert.equal(outputs.ios_hash, IOS_HASH);
    assert.equal(outputs.android_hash, ANDROID_HASH);
  });

  it("queues every platform when both fingerprints are new", async () => {
    const {outputs} = await runDecide([]);

    assert.equal(outputs.needs_build, "true");
    assert.equal(outputs.ios_device_match, "false");
    assert.equal(outputs.ios_sim_match, "false");
    assert.equal(outputs.android_match, "false");
    assert.equal(outputs.ios_device_active, "false");
    assert.equal(outputs.android_active, "false");
  });

  it("takes the fast path when the fingerprint already has finished builds", async () => {
    const {outputs} = await runDecide([
      "ios|development|finished",
      "ios|development:simulator|finished",
      "android|development|finished",
    ]);

    assert.equal(outputs.needs_build, "false");
    assert.equal(outputs.ios_device_finished, "true");
    assert.equal(outputs.android_finished, "true");
  });

  it("does not re-seed a missing platform for a known fingerprint", async () => {
    const {outputs} = await runDecide([
      "ios|development:simulator|finished",
      "android|development|finished",
    ]);

    assert.equal(outputs.needs_build, "false");
    assert.equal(outputs.ios_device_finished, "false");
    assert.equal(outputs.ios_device_active, "false");
  });

  it("keeps iOS and Android hashes independent", async () => {
    // Android unchanged (finished build exists), iOS runtime is new.
    const {outputs} = await runDecide(["android|development|finished"]);

    assert.equal(outputs.needs_build, "true");
    assert.equal(outputs.ios_device_match, "false");
    assert.equal(outputs.ios_sim_match, "false");
    assert.equal(outputs.android_match, "true");
    assert.equal(outputs.android_active, "false");
  });

  it("queues Android when only the Android hash is new", async () => {
    const {outputs} = await runDecide([
      "ios|development|finished",
      "ios|development:simulator|finished",
    ]);

    assert.equal(outputs.needs_build, "true");
    assert.equal(outputs.android_match, "false");
    assert.equal(outputs.android_active, "false");
    assert.equal(outputs.ios_device_match, "true");
    assert.equal(outputs.ios_sim_match, "true");
  });

  for (const status of ["new", "in-queue", "in-progress"]) {
    it(`treats ${status} builds as covered so pushes do not duplicate them`, async () => {
      const {outputs} = await runDecide([
        `ios|development|${status}`,
        `ios|development:simulator|${status}`,
        `android|development|${status}`,
      ]);

      assert.equal(outputs.needs_build, "false");
      assert.equal(outputs.ios_device_match, "true");
      assert.equal(outputs.ios_sim_match, "true");
      assert.equal(outputs.android_match, "true");
      // Nothing finished yet, so install links still flag the gap.
      assert.equal(outputs.ios_device_finished, "false");
      assert.equal(outputs.ios_device_active, "true");
      assert.equal(outputs.ios_sim_active, "true");
      assert.equal(outputs.android_active, "true");
    });
  }

  it("still queues platforms that have no active build alongside one that does", async () => {
    const {outputs} = await runDecide(["ios|development|in-progress"]);

    assert.equal(outputs.needs_build, "true");
    assert.equal(outputs.ios_device_match, "true");
    assert.equal(outputs.ios_sim_match, "false");
    assert.equal(outputs.android_match, "false");
  });

  it("exposes latest finished build ids for install links", async () => {
    const {outputs} = await runDecide([]);

    assert.equal(outputs.ios_device_latest, "latest-ios");
    assert.equal(outputs.android_latest, "latest-android");
  });
});
