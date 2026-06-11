import {describe, expect, it} from "bun:test";

describe("instrument startup", () => {
  it("does not crash when SENTRY_DSN is missing in production", async () => {
    const bunExecutable = Bun.which("bun") || process.execPath || process.argv0 || "bun";
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
