import {describe, expect, it} from "bun:test";

import {diffImportGraphs, measureImportGraph, resolvePackageEntry} from "./importGraph";

describe("importGraph", () => {
  it("resolves the root package entry", () => {
    expect(resolvePackageEntry("@terreno/ui")).toContain("index.tsx");
  });

  it("resolves a component subpath entry", () => {
    expect(resolvePackageEntry("@terreno/ui/Button")).toContain("Button.tsx");
  });

  it("resolves a TypeScript subpath entry", () => {
    expect(resolvePackageEntry("@terreno/ui/emojiCategories")).toContain("emojiCategories.ts");
  });

  it("rejects unsupported import paths", () => {
    expect(() => resolvePackageEntry("@terreno/not-ui")).toThrow(/Unsupported import path/);
  });

  it("measures a bounded import graph for Button", () => {
    const graph = measureImportGraph(resolvePackageEntry("@terreno/ui/Button"));

    expect(graph.moduleCount).toBeGreaterThan(0);
    expect(graph.outputBytes).toBeGreaterThan(0);
    expect(graph.modulePaths).toContain(resolvePackageEntry("@terreno/ui/Button"));
  });

  it("returns modules present only in the baseline graph", () => {
    expect(
      diffImportGraphs({
        baselinePaths: ["src/Button.tsx", "src/Box.tsx"],
        comparisonPaths: ["src/Button.tsx"],
      })
    ).toEqual(["src/Box.tsx"]);
  });
});
