import {describe, expect, it} from "bun:test";
import {mkdirSync, unlinkSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";

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

  it("ignores missing relative imports", () => {
    const tmp = join(tmpdir(), `import-graph-missing-${Date.now()}.ts`);
    writeFileSync(tmp, 'import {missing} from "./definitely-missing-mod";\nexport const ok = 1;\n');
    try {
      const graph = measureImportGraph(tmp);
      expect(graph.moduleCount).toBe(1);
      expect(graph.modulePaths).toEqual([tmp]);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("skips unreadable entry files", () => {
    const graph = measureImportGraph(import.meta.dir);
    expect(graph.moduleCount).toBe(1);
    expect(graph.entryFile).toBe(import.meta.dir);
  });

  it("resolves a dist-only subpath", () => {
    const distRoot = resolve(import.meta.dir, "../../dist");
    mkdirSync(distRoot, {recursive: true});
    const distFile = join(distRoot, "newFileCoverageStub.js");
    writeFileSync(distFile, "export const stub = true;\n");
    try {
      expect(resolvePackageEntry("@terreno/ui/newFileCoverageStub")).toBe(distFile);
    } finally {
      unlinkSync(distFile);
    }
  });
});
