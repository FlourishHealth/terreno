import {spawnSync} from "node:child_process";
import {join} from "node:path";
import {describe, it} from "bun:test";
import {assert} from "chai";

interface HookResult {
  status: number | null;
  stderr: string;
  stdout: string;
}

const repositoryRoot = join(import.meta.dir, "../..");
const qualityCheckScript = join(repositoryRoot, ".rulesync/hooks/quality-check.sh");
const hookHosts = ["cursor", "claudecode", "copilot", "devin"] as const;

const runHook = ({
  hookHost,
  hookInput = "{}",
  lintStatus,
  typecheckStatus,
}: {
  hookHost: (typeof hookHosts)[number];
  hookInput?: string;
  lintStatus: number;
  typecheckStatus: number;
}): HookResult => {
  const command = `
bun() {
  if [[ "$*" == "run lint" ]]; then
    echo "lint output" >&2
    return "$LINT_STATUS"
  fi
  if [[ "$*" == "run compile" ]]; then
    echo "typecheck output" >&2
    return "$TYPECHECK_STATUS"
  fi
  return 99
}
export -f bun
exec "$QUALITY_CHECK_SCRIPT" "$HOOK_HOST"
`;
  const result = spawnSync("bash", ["-c", command], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      HOOK_HOST: hookHost,
      LINT_STATUS: String(lintStatus),
      QUALITY_CHECK_SCRIPT: qualityCheckScript,
      TYPECHECK_STATUS: String(typecheckStatus),
    },
    input: hookInput,
  });

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
};

describe("quality-check hook", (): void => {
  it("returns valid allow JSON after both checks pass", (): void => {
    for (const hookHost of hookHosts) {
      const result = runHook({hookHost, lintStatus: 0, typecheckStatus: 0});

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {});
      assert.include(result.stderr, "lint output");
      assert.include(result.stderr, "typecheck output");
    }
  });

  it("returns a Cursor follow-up when either check fails", (): void => {
    const result = runHook({hookHost: "cursor", lintStatus: 7, typecheckStatus: 9});

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      followup_message:
        "Lint or typecheck failed (lint=7, typecheck=9). Fix the reported errors before stopping.",
    });
    assert.include(result.stderr, "Quality checks failed: lint=7 typecheck=9");
  });

  it("returns a blocking decision for Claude Code, Copilot, and Devin", (): void => {
    for (const hookHost of ["claudecode", "copilot", "devin"] as const) {
      const result = runHook({hookHost, lintStatus: 7, typecheckStatus: 9});

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        decision: "block",
        reason:
          "Lint or typecheck failed (lint=7, typecheck=9). Fix the reported errors before stopping.",
      });
    }
  });

  it("allows a structured-host retry to stop without rerunning checks", (): void => {
    const result = runHook({
      hookHost: "claudecode",
      hookInput: '{"stop_hook_active": true}',
      lintStatus: 99,
      typecheckStatus: 99,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {});
    assert.equal(result.stderr, "");
  });
});
