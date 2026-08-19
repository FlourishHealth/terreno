import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {afterEach, beforeEach, describe, it} from "bun:test";
import {assert} from "chai";

const DOWNLOAD_SCRIPT = join(import.meta.dir, "../demo/appium/downloadLatestEasBuild.ts");
const DEMO_DIRECTORY = join(import.meta.dir, "../demo");
const FINGERPRINT_HASH = "matching-native-fingerprint";
const FALLBACK_FINGERPRINT_HASH = "fallback-native-fingerprint";

let workDirectory: string;

const runDownloader = ({
  fallbackProfile,
  isLargeFingerprint = false,
  isPrimaryBuildMissing = false,
}: {
  fallbackProfile?: string;
  isLargeFingerprint?: boolean;
  isPrimaryBuildMissing?: boolean;
} = {}): ReturnType<typeof Bun.spawnSync> => {
  const appPath = join(workDirectory, "matching-build.apk");
  const envFile = join(workDirectory, "github-env");
  const invocationLog = join(workDirectory, "bunx-invocations");
  writeFileSync(appPath, "");
  writeFileSync(envFile, "");

  const fakeBunx = `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$FAKE_INVOCATION_LOG"

if [ "$1" != "eas-cli@latest" ]; then
  echo "unexpected package: $1" >&2
  exit 1
fi
shift

command="$1"
shift

case "$command" in
  fingerprint:generate)
    profile=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --build-profile) profile="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    if [ "$profile" = "fallback" ]; then
      echo '{"hash":"${FALLBACK_FINGERPRINT_HASH}"}'
    elif [ "$profile" = "development" ]; then
      if [ "$FAKE_LARGE_FINGERPRINT" = "true" ]; then
        "$FAKE_REAL_BUN" -e 'process.stdout.write(JSON.stringify({hash: process.env.FAKE_FINGERPRINT_HASH, sources: "x".repeat(2 * 1024 * 1024)}))'
      else
        echo '{"hash":"${FINGERPRINT_HASH}"}'
      fi
    else
      echo "fingerprint was not computed for the selected build profile" >&2
      exit 43
    fi
    ;;
  build:list)
    profile=""
    fingerprint=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --build-profile) profile="$2"; shift 2 ;;
        --fingerprint-hash) fingerprint="$2"; shift 2 ;;
        *) shift ;;
      esac
    done
    expected_fingerprint="${FINGERPRINT_HASH}"
    if [ "$profile" = "fallback" ]; then
      expected_fingerprint="${FALLBACK_FINGERPRINT_HASH}"
    fi
    if [ "$fingerprint" != "$expected_fingerprint" ]; then
      echo "build lookup was not scoped to the current fingerprint" >&2
      exit 42
    fi
    if [ "$profile" = "development" ] && [ "$FAKE_PRIMARY_BUILD_MISSING" = "true" ]; then
      echo '[]'
      exit 0
    fi
    echo '[{"id":"matching-build"}]'
    ;;
  build:download)
    echo '{"path":"'"$FAKE_APP_PATH"'"}'
    ;;
  *)
    echo "unexpected command: $command" >&2
    exit 1
    ;;
esac
`;
  writeFileSync(join(workDirectory, "bunx"), fakeBunx, {mode: 0o755});

  const command = [
    process.execPath,
    DOWNLOAD_SCRIPT,
    "--platform",
    "android",
    "--profile",
    "development",
    "--env-file",
    envFile,
  ];
  if (fallbackProfile) {
    command.push("--fallback-profile", fallbackProfile);
  }

  return Bun.spawnSync({
    cmd: command,
    cwd: DEMO_DIRECTORY,
    env: {
      ...process.env,
      FAKE_APP_PATH: appPath,
      FAKE_FINGERPRINT_HASH: FINGERPRINT_HASH,
      FAKE_INVOCATION_LOG: invocationLog,
      FAKE_LARGE_FINGERPRINT: String(isLargeFingerprint),
      FAKE_PRIMARY_BUILD_MISSING: String(isPrimaryBuildMissing),
      FAKE_REAL_BUN: process.execPath,
      PATH: `${workDirectory}:${process.env.PATH ?? ""}`,
    },
  });
};

describe("downloadLatestEasBuild", () => {
  beforeEach((): void => {
    workDirectory = mkdtempSync(join(tmpdir(), "eas-build-download-"));
  });

  afterEach((): void => {
    rmSync(workDirectory, {force: true, recursive: true});
  });

  it("downloads a finished build matching the current native fingerprint", async (): Promise<void> => {
    const result = runDownloader();
    const invocations = await Bun.file(join(workDirectory, "bunx-invocations")).text();

    assert.equal(
      result.exitCode,
      0,
      `${result.stderr.toString()}\n${result.stdout.toString()}`
    );
    assert.include(
      invocations,
      `fingerprint:generate --platform android --build-profile development --non-interactive --json`
    );
    assert.include(invocations, `build:list --platform android`);
    assert.include(invocations, `--fingerprint-hash ${FINGERPRINT_HASH}`);
  });

  it("recomputes the fingerprint when using a fallback profile", async (): Promise<void> => {
    const result = runDownloader({
      fallbackProfile: "fallback",
      isPrimaryBuildMissing: true,
    });
    const invocations = await Bun.file(join(workDirectory, "bunx-invocations")).text();

    assert.equal(
      result.exitCode,
      0,
      `${result.stderr.toString()}\n${result.stdout.toString()}`
    );
    assert.include(
      invocations,
      `fingerprint:generate --platform android --build-profile fallback --non-interactive --json`
    );
    assert.include(
      invocations,
      `build:list --platform android --status finished --build-profile fallback --fingerprint-hash ${FALLBACK_FINGERPRINT_HASH}`
    );
  });

  it("accepts the full fingerprint payload emitted by EAS", () => {
    const result = runDownloader({isLargeFingerprint: true});

    assert.equal(
      result.exitCode,
      0,
      `${result.stderr.toString()}\n${result.stdout.toString()}`
    );
  });
});
