import {assert} from "chai";

import {
  diffImportGraphs,
  measureImportGraph,
  resolvePackageEntry,
} from "./importGraph";
import {measureFreshImportTiming} from "./importTiming";

const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 2;

interface ImportBenchmarkWorkload {
  importPath: string;
  label: string;
}

interface ImportBenchmarkResult {
  elapsedMs: number;
  importPath: string;
  label: string;
  moduleCount: number;
  outputBytes: number;
}

const WORKLOADS: ImportBenchmarkWorkload[] = [
  {importPath: "@terreno/ui/Button", label: "button-subpath"},
  {importPath: "@terreno/ui/DataTable", label: "datatable-subpath"},
  {importPath: "@terreno/ui/MarkdownView", label: "markdownview-subpath"},
  {importPath: "@terreno/ui", label: "root-full"},
];

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const measureWorkload = ({
  importPath,
  label,
  sampleCount,
  warmupCount,
}: ImportBenchmarkWorkload & {
  sampleCount: number;
  warmupCount: number;
}): ImportBenchmarkResult => {
  const graph = measureImportGraph(resolvePackageEntry(importPath));
  const timing = measureFreshImportTiming({
    importPath,
    sampleCount,
    warmupCount,
  });

  return {
    elapsedMs: timing.elapsedMs,
    importPath,
    label,
    moduleCount: graph.moduleCount,
    outputBytes: graph.outputBytes,
  };
};

describe.skipIf(process.env.RUN_UI_IMPORT_BENCHMARK !== "1")("root import benchmark", () => {
  it(
    "compares root and subpath import graphs and fresh-process timings",
    () => {
      const sampleCount = Number(process.env.UI_IMPORT_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT);
      const warmupCount = Number(process.env.UI_IMPORT_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT);

      const results = WORKLOADS.map((workload) =>
        measureWorkload({...workload, sampleCount, warmupCount})
      );

      const buttonSubpath = results.find((result) => result.label === "button-subpath");
      const rootFull = results.find((result) => result.label === "root-full");

      assert.isDefined(buttonSubpath);
      assert.isDefined(rootFull);
      assert.isBelow(buttonSubpath.moduleCount, rootFull.moduleCount);
      assert.isBelow(buttonSubpath.outputBytes, rootFull.outputBytes);
      assert.isBelow(buttonSubpath.elapsedMs, rootFull.elapsedMs);

      const rootGraph = measureImportGraph(resolvePackageEntry("@terreno/ui"));
      const buttonGraph = measureImportGraph(resolvePackageEntry("@terreno/ui/Button"));
      const deferredModules = diffImportGraphs({
        baselinePaths: rootGraph.modulePaths,
        comparisonPaths: buttonGraph.modulePaths,
      });

      console.info(
        `UI_IMPORT_BENCHMARK_RESULTS=${JSON.stringify({
          deferredModuleCount: deferredModules.length,
          results,
        })}`
      );
    },
    300_000
  );
});

export const summarizeImportBenchmarkResults = (
  results: ImportBenchmarkResult[]
): {medianElapsedMs: number; totalModuleCount: number; totalOutputBytes: number} => {
  return {
    medianElapsedMs: median(results.map((result) => result.elapsedMs)),
    totalModuleCount: results.reduce((total, result) => total + result.moduleCount, 0),
    totalOutputBytes: results.reduce((total, result) => total + result.outputBytes, 0),
  };
};
