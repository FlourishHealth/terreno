import {describe, expect, it} from "bun:test";

import {evaluateCoverage, parseAllFilesRow, parseArgs, stripAnsi} from "./check-coverage";

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
