import {describe, expect, it} from "bun:test";

describe("instrument startup", () => {
  it("does not crash when SENTRY_DSN is missing in production", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSentryDsn = process.env.SENTRY_DSN;
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    let stderrOutput = "";

    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrOutput += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stderr.write;

    try {
      process.env.NODE_ENV = "production";
      process.env.SENTRY_DSN = "";
      await import(`./instrument.ts?instrument-test=${Date.now()}`);
    } finally {
      process.stderr.write = originalStderrWrite;

      if (originalNodeEnv === undefined) {
        Reflect.deleteProperty(process.env, "NODE_ENV");
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }

      if (originalSentryDsn === undefined) {
        Reflect.deleteProperty(process.env, "SENTRY_DSN");
      } else {
        process.env.SENTRY_DSN = originalSentryDsn;
      }
    }

    expect(stderrOutput).toContain("SENTRY_DSN is not set; Sentry initialization skipped.");
  });
});
