/**
 * Isolated tests for buildNumber.ts paths that require mock.module.
 *
 * These live in isolated/ so that mock.module calls do not interfere
 * with coverage tracking in the main buildNumber.test.ts file.
 */
import {describe, expect, it, mock} from "bun:test";

describe("resolveBuildNumber catch path", () => {
  it("returns undefined when execSync throws (no git available)", async () => {
    const originalEnvValue = process.env.EXPO_PUBLIC_BUILD_NUMBER;
    delete process.env.EXPO_PUBLIC_BUILD_NUMBER;
    mock.module("node:child_process", () => ({
      execSync: (): never => {
        throw new Error("git command not found");
      },
    }));
    try {
      const testId = `${Date.now()}-${Math.random()}`;
      const loaded = (await import(
        `../buildNumber?case=${testId}`
      )) as typeof import("../buildNumber");
      const result = loaded.resolveBuildNumber();
      expect(result).toBeUndefined();
    } finally {
      if (originalEnvValue !== undefined) {
        process.env.EXPO_PUBLIC_BUILD_NUMBER = originalEnvValue;
      }
    }
  });
});
