import {describe, expect, it} from "bun:test";
import {existsSync} from "node:fs";

describe("instrument startup", () => {
  it("does not crash when SENTRY_DSN is missing in production", async () => {
    const bunExecutable =
      ["/proc/self/exe", process.execPath, process.argv0, Bun.which("bun")]
        .filter((candidate): candidate is string => candidate !== undefined)
        .find((candidate) => existsSync(candidate)) || "bun";

    const child = Bun.spawn({
      cmd: [bunExecutable, "--eval", 'import("./src/instrument.ts")'],
      cwd: "/workspace/example-backend",
      env: {
        ...process.env,
        NODE_ENV: "production",
        SENTRY_DSN: "",
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("SENTRY_DSN is not set; Sentry initialization skipped.");
  });
});
