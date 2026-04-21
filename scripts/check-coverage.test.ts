import {describe, expect, it} from "bun:test";

import {
  evaluateCoverage,
  mergeLcov,
  parseAllFilesRow,
  parseArgs,
  parseLcov,
  stripAnsi,
  summarizeLcov,
} from "./check-coverage";

const ESC = String.fromCharCode(27);

describe("parseArgs", () => {
  it("defaults to 95 when no flags are passed", () => {
    expect(parseArgs([])).toEqual({threshold: 95});
  });

  it("parses an integer threshold", () => {
    expect(parseArgs(["--threshold=80"])).toEqual({threshold: 80});
  });

  it("parses a fractional threshold", () => {
    expect(parseArgs(["--threshold=92.5"])).toEqual({threshold: 92.5});
  });

  it("ignores unrelated flags", () => {
    expect(parseArgs(["--foo", "bar", "--threshold=50"])).toEqual({threshold: 50});
  });

  it("keeps the last value when the flag appears multiple times", () => {
    expect(parseArgs(["--threshold=70", "--threshold=85"])).toEqual({threshold: 85});
  });
});

describe("stripAnsi", () => {
  it("returns the input unchanged when there are no escape codes", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("removes common color escape sequences", () => {
    const coloured = `${ESC}[31mred${ESC}[0m and ${ESC}[1;32mbold green${ESC}[0m`;
    expect(stripAnsi(coloured)).toBe("red and bold green");
  });
});

describe("parseAllFilesRow", () => {
  const buildReport = (funcPct: string, linePct: string): string =>
    [
      "-------------------|---------|---------|-------------------",
      "File               | % Funcs | % Lines | Uncovered Line #s",
      "-------------------|---------|---------|-------------------",
      `All files          |  ${funcPct} |  ${linePct} |`,
      " foo.ts            |  100.00 |  100.00 |",
      "-------------------|---------|---------|-------------------",
    ].join("\n");

  it("parses the function and line coverage from a plain report", () => {
    expect(parseAllFilesRow(buildReport("95.95", "96.13"))).toEqual({
      functions: 95.95,
      lines: 96.13,
    });
  });

  it("parses the coverage row when the report contains ANSI colour codes", () => {
    const coloured = buildReport(`${ESC}[32m100.00${ESC}[0m`, `${ESC}[32m100.00${ESC}[0m`);
    expect(parseAllFilesRow(coloured)).toEqual({functions: 100, lines: 100});
  });

  it("returns null when the report does not contain an All files row", () => {
    expect(parseAllFilesRow("nothing to see here")).toBeNull();
  });

  it("returns null when the All files row is malformed", () => {
    expect(parseAllFilesRow("All files | not-a-number | not-a-number |")).toBeNull();
  });
});

describe("evaluateCoverage", () => {
  it("returns an empty list when both metrics meet the threshold", () => {
    expect(evaluateCoverage({functions: 95, lines: 95}, 95)).toEqual([]);
    expect(evaluateCoverage({functions: 99, lines: 100}, 95)).toEqual([]);
  });

  it("flags function coverage that is below the threshold", () => {
    expect(evaluateCoverage({functions: 90, lines: 96}, 95)).toEqual([
      {metric: "functions", actual: 90, threshold: 95},
    ]);
  });

  it("flags line coverage that is below the threshold", () => {
    expect(evaluateCoverage({functions: 96, lines: 90}, 95)).toEqual([
      {metric: "lines", actual: 90, threshold: 95},
    ]);
  });

  it("flags both metrics when both are below the threshold", () => {
    expect(evaluateCoverage({functions: 80, lines: 85}, 95)).toEqual([
      {metric: "functions", actual: 80, threshold: 95},
      {metric: "lines", actual: 85, threshold: 95},
    ]);
  });
});

const lcovRecord = ({
  path,
  functions,
  lines,
}: {
  path: string;
  functions: Array<{line: number; name: string; hits: number}>;
  lines: Array<{line: number; hits: number}>;
}): string => {
  const sections: string[] = [`SF:${path}`];
  for (const fn of functions) {
    sections.push(`FN:${fn.line},${fn.name}`);
  }
  for (const fn of functions) {
    sections.push(`FNDA:${fn.hits},${fn.name}`);
  }
  sections.push(`FNF:${functions.length}`);
  sections.push(`FNH:${functions.filter((f) => f.hits > 0).length}`);
  for (const ln of lines) {
    sections.push(`DA:${ln.line},${ln.hits}`);
  }
  sections.push(`LF:${lines.length}`);
  sections.push(`LH:${lines.filter((l) => l.hits > 0).length}`);
  sections.push("end_of_record");
  return sections.join("\n");
};

describe("parseLcov", () => {
  it("records function names with per-function hit counts", () => {
    const text = lcovRecord({
      path: "src/foo.ts",
      functions: [
        {line: 1, name: "a", hits: 1},
        {line: 5, name: "b", hits: 0},
      ],
      lines: [
        {line: 1, hits: 3},
        {line: 2, hits: 0},
      ],
    });
    const result = parseLcov(text);
    const entry = result.get("src/foo.ts");
    expect(entry).toBeDefined();
    expect(entry?.hasFnRecords).toBe(true);
    expect(entry?.functions.get("1:a")).toBe(1);
    expect(entry?.functions.get("5:b")).toBe(0);
    expect(entry?.lines.get(1)).toBe(3);
    expect(entry?.lines.get(2)).toBe(0);
  });

  it("disambiguates multiple FN records that share a name", () => {
    const text = [
      "SF:src/bar.ts",
      "FN:1,<anonymous>",
      "FN:1,<anonymous>",
      "FNDA:2,<anonymous>",
      "FNDA:0,<anonymous>",
      "end_of_record",
    ].join("\n");
    const result = parseLcov(text);
    const entry = result.get("src/bar.ts");
    expect(entry).toBeDefined();
    expect(entry?.functions.size).toBe(2);
    expect(entry?.functions.get("1:<anonymous>")).toBe(2);
    expect(entry?.functions.get("1:<anonymous>#2")).toBe(0);
  });

  it("ignores records without a current file", () => {
    const result = parseLcov("DA:1,1\nFN:1,orphan\nend_of_record\n");
    expect(result.size).toBe(0);
  });
});

describe("mergeLcov", () => {
  it("unions per-function hit counts across runs", () => {
    const a = parseLcov(
      lcovRecord({
        path: "src/foo.ts",
        functions: [
          {line: 1, name: "one", hits: 1},
          {line: 5, name: "two", hits: 1},
          {line: 9, name: "three", hits: 0},
        ],
        lines: [{line: 1, hits: 2}],
      })
    );
    const b = parseLcov(
      lcovRecord({
        path: "src/foo.ts",
        functions: [
          {line: 1, name: "one", hits: 0},
          {line: 5, name: "two", hits: 0},
          {line: 9, name: "three", hits: 4},
        ],
        lines: [{line: 1, hits: 5}],
      })
    );
    const merged = mergeLcov(new Map(), a);
    mergeLcov(merged, b);
    const entry = merged.get("src/foo.ts");
    expect(entry).toBeDefined();
    expect(entry?.functions.get("1:one")).toBe(1);
    expect(entry?.functions.get("5:two")).toBe(1);
    expect(entry?.functions.get("9:three")).toBe(4);
    expect(entry?.lines.get(1)).toBe(5);
  });

  it("copies files from source when target is missing them", () => {
    const a = parseLcov(
      lcovRecord({
        path: "src/a.ts",
        functions: [{line: 1, name: "fn", hits: 1}],
        lines: [{line: 1, hits: 1}],
      })
    );
    const b = parseLcov(
      lcovRecord({
        path: "src/b.ts",
        functions: [{line: 1, name: "fn", hits: 1}],
        lines: [{line: 1, hits: 1}],
      })
    );
    const merged = mergeLcov(new Map(), a);
    mergeLcov(merged, b);
    expect(merged.get("src/a.ts")).toBeDefined();
    expect(merged.get("src/b.ts")).toBeDefined();
  });
});

describe("summarizeLcov", () => {
  it("counts a function as hit once it has non-zero hits in any run", () => {
    const coverage = parseLcov(
      lcovRecord({
        path: "src/foo.ts",
        functions: [
          {line: 1, name: "one", hits: 1},
          {line: 5, name: "two", hits: 0},
        ],
        lines: [
          {line: 1, hits: 1},
          {line: 2, hits: 0},
        ],
      })
    );
    expect(summarizeLcov(coverage)).toEqual({functions: 50, lines: 50});
  });

  it("returns 100 for empty coverage to avoid division by zero", () => {
    expect(summarizeLcov(new Map())).toEqual({functions: 100, lines: 100});
  });

  it("merging 1-8 and 6-10 hit sets reports the full union as hit", () => {
    // Regression test: with FN/FNDA records, merging runs that cover different
    // subsets of functions in the same file must take the true union, not the
    // max(FNH) approximation.
    const runA = parseLcov(
      lcovRecord({
        path: "src/file.ts",
        functions: Array.from({length: 10}, (_, idx) => ({
          line: idx + 1,
          name: `fn${idx + 1}`,
          hits: idx + 1 <= 8 ? 1 : 0,
        })),
        lines: [{line: 1, hits: 1}],
      })
    );
    const runB = parseLcov(
      lcovRecord({
        path: "src/file.ts",
        functions: Array.from({length: 10}, (_, idx) => ({
          line: idx + 1,
          name: `fn${idx + 1}`,
          hits: idx + 1 >= 6 ? 1 : 0,
        })),
        lines: [{line: 1, hits: 1}],
      })
    );
    const merged = mergeLcov(new Map(), runA);
    mergeLcov(merged, runB);
    expect(summarizeLcov(merged)).toEqual({functions: 100, lines: 100});
  });

  it("falls back to FNF/FNH aggregates when the LCOV producer omits FN records", () => {
    // Bun 1.3.x emits FNF/FNH but not FN/FNDA. We must still report coverage
    // in that case, even though we can't compute a true cross-run union.
    const text = [
      "SF:src/foo.ts",
      "FNF:10",
      "FNH:7",
      "DA:1,1",
      "DA:2,0",
      "end_of_record",
    ].join("\n");
    const parsed = parseLcov(text);
    expect(parsed.get("src/foo.ts")?.hasFnRecords).toBe(false);
    expect(summarizeLcov(parsed)).toEqual({functions: 70, lines: 50});
  });

  it("prefers FN/FNDA data over aggregates when both are present in the merge target", () => {
    // Once a file picks up FN records from any run, summarize should switch to
    // the per-function path so it reflects the full union.
    const withFn = parseLcov(
      lcovRecord({
        path: "src/foo.ts",
        functions: [
          {line: 1, name: "one", hits: 1},
          {line: 5, name: "two", hits: 1},
        ],
        lines: [{line: 1, hits: 1}],
      })
    );
    const aggregateOnly = parseLcov(
      ["SF:src/foo.ts", "FNF:2", "FNH:0", "DA:1,0", "end_of_record"].join("\n")
    );
    const merged = mergeLcov(new Map(), aggregateOnly);
    mergeLcov(merged, withFn);
    expect(merged.get("src/foo.ts")?.hasFnRecords).toBe(true);
    expect(summarizeLcov(merged)).toEqual({functions: 100, lines: 100});
  });
});
