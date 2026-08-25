import {describe, expect, it} from "bun:test";

import {compareBenchmarkSamples, measureFreshImportTiming} from "./importTiming";

describe("importTiming", () => {
  it("sorts benchmark samples for median timing", () => {
    expect(compareBenchmarkSamples(2, 1)).toBe(1);
  });

  it("throws when the fresh import probe fails", () => {
    expect(() =>
      measureFreshImportTiming({
        importPath: "@terreno/ui/__definitely-missing-module__",
        sampleCount: 1,
        warmupCount: 0,
      })
    ).toThrow(/Fresh import probe failed/);
  });

  it(
    "measures fresh-process import timing for a small subpath",
    () => {
      const timing = measureFreshImportTiming({
        importPath: "@terreno/ui/Button",
        sampleCount: 1,
        warmupCount: 1,
      });

      expect(timing.importPath).toBe("@terreno/ui/Button");
      expect(timing.samplesMs).toHaveLength(1);
      expect(timing.elapsedMs).toBeGreaterThan(0);
    },
    120_000
  );
});
