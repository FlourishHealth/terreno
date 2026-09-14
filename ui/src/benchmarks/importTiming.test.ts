import {describe, expect, it} from "bun:test";
import {existsSync, readdirSync} from "node:fs";
import {resolve} from "node:path";

import {compareBenchmarkSamples, measureFreshImportTiming} from "./importTiming";

const UI_PACKAGE_ROOT = resolve(import.meta.dir, "../..");
const leftoverProbePath = resolve(UI_PACKAGE_ROOT, "src/benchmarks/.fresh-import-probe.ts");

describe("importTiming", () => {
  it("sorts benchmark samples for median timing", () => {
    expect(compareBenchmarkSamples(2, 1)).toBe(1);
  });

  it("throws when the fresh import probe fails", () => {
    expect(() =>
      measureFreshImportTiming({
        importPath: "../__definitely-missing-module__",
        sampleCount: 1,
        warmupCount: 0,
      })
    ).toThrow(/Fresh import probe failed/);
  });

  it("measures fresh-process import timing for a small subpath", () => {
    const timing = measureFreshImportTiming({
      importPath: "../Button",
      sampleCount: 1,
      warmupCount: 1,
    });

    expect(timing.importPath).toBe("../Button");
    expect(timing.samplesMs).toHaveLength(1);
    expect(timing.elapsedMs).toBeGreaterThan(0);
    expect(existsSync(leftoverProbePath)).toBe(false);
    expect(
      readdirSync(resolve(UI_PACKAGE_ROOT, "src/benchmarks")).some((name) =>
        name.includes("fresh-import-probe")
      )
    ).toBe(false);
  }, 120_000);
});
