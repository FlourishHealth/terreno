import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {afterEach, beforeEach, describe, it} from "bun:test";
import {assert} from "chai";

const repoRoot = join(import.meta.dir, "..");
const selectiveBuildScript = join(
  repoRoot,
  ".github/workflows/scripts/eas-pr-selective-build.sh"
);

const FAKE_EAS = `#!/usr/bin/env bash
set -euo pipefail
echo "$*" >> "$FAKE_EAS_LOG"
if [ -n "\${FAKE_FAIL_ON:-}" ] && [[ "$*" == *"$FAKE_FAIL_ON"* ]]; then
  exit 1
fi
`;

let workDir: string;

interface SelectiveBuildResult {
  exitCode: number;
  invocations: string;
  outputs: Record<string, string>;
}

const runSelectiveBuild = async ({
  failOn,
}: {
  failOn?: string;
} = {}): Promise<SelectiveBuildResult> => {
  const outputPath = join(workDir, "github-output");
  const logPath = join(workDir, "eas-log");
  writeFileSync(outputPath, "");
  writeFileSync(logPath, "");

  const result = Bun.spawnSync({
    cmd: ["bash", selectiveBuildScript],
    env: {
      ...process.env,
      ANDROID_MATCH: "false",
      FAKE_EAS_LOG: logPath,
      FAKE_FAIL_ON: failOn ?? "",
      GITHUB_OUTPUT: outputPath,
      IOS_DEVICE_MATCH: "false",
      IOS_SIM_MATCH: "false",
      PATH: `${workDir}:${process.env.PATH ?? ""}`,
    },
  });

  const outputs: Record<string, string> = {};
  for (const line of (await Bun.file(outputPath).text()).split("\n")) {
    if (!line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    outputs[key] = rest.join("=");
  }

  return {
    exitCode: result.exitCode,
    invocations: await Bun.file(logPath).text(),
    outputs,
  };
};

describe("eas-pr-selective-build.sh", () => {
  beforeEach((): void => {
    workDir = mkdtempSync(join(tmpdir(), "eas-selective-build-"));
    writeFileSync(join(workDir, "eas"), FAKE_EAS, {mode: 0o755});
  });

  afterEach((): void => {
    rmSync(workDir, {force: true, recursive: true});
  });

  it("marks each build queued only after successful dispatch", async (): Promise<void> => {
    const result = await runSelectiveBuild();

    assert.equal(result.exitCode, 0);
    assert.equal(result.outputs.ios_device_queued, "true");
    assert.equal(result.outputs.ios_sim_queued, "true");
    assert.equal(result.outputs.android_queued, "true");
  });

  it("leaves failed and unattempted dispatches unqueued", async (): Promise<void> => {
    const result = await runSelectiveBuild({failOn: "--platform ios"});

    assert.notEqual(result.exitCode, 0);
    assert.equal(result.outputs.ios_device_queued, "true");
    assert.equal(result.outputs.ios_sim_queued, "false");
    assert.equal(result.outputs.android_queued, "false");
    assert.notInclude(result.invocations, "--platform android");
  });
});
