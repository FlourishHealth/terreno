import {describe, it} from "bun:test";
import {mkdirSync, mkdtempSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {assert} from "chai";

import {
  collectReachable,
  isPassThroughBarrel,
  isTypeOnlyClause,
  parseImportClause,
  parseImportEdges,
  parseLocalExportNames,
  parseReexports,
  resolveSpecifier,
  runtimeSkeleton,
  stripTypeDeclarations,
} from "./moduleGraph";

const createRepo = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "terreno-e2e-graph-"));
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(root, path);
    mkdirSync(join(absolute, ".."), {recursive: true});
    writeFileSync(absolute, contents);
  }
  return root;
};

describe("parseImportClause", () => {
  it("lists named bindings", () => {
    assert.deepEqual(parseImportClause(" {Box, Text as Label} "), ["Box", "Text"]);
  });

  it("treats a namespace import as the whole module", () => {
    assert.isNull(parseImportClause(" * as Sentry "));
  });

  it("treats a default import as the default binding", () => {
    assert.deepEqual(parseImportClause(" React "), ["default"]);
  });

  it("falls back to the whole module when the clause spans statements", () => {
    assert.isNull(parseImportClause(" const value = 1; import {Box} "));
  });
});

describe("parseImportEdges", () => {
  it("collects static, dynamic, and require edges", () => {
    const edges = parseImportEdges(
      [
        'import {Box} from "./Box";',
        'import "./sideEffect";',
        'const lazy = await import("./Lazy");',
        'const asset = require("./asset.png");',
      ].join("\n")
    );
    assert.deepEqual(edges.map((edge) => edge.specifier).sort(), [
      "./Box",
      "./Lazy",
      "./asset.png",
      "./sideEffect",
    ]);
  });

  it("marks type-only imports so they carry no runtime edge", () => {
    const [edge] = parseImportEdges('import type {BoxProps} from "./Box";');
    assert.isTrue(edge?.typeOnly);
  });

  it("keys lazy factory entries by their object key", () => {
    const edges = parseImportEdges('const map = {Chart: () => import("../Chart")};');
    assert.equal(edges[0]?.key, "Chart");
    assert.equal(edges[0]?.specifier, "../Chart");
  });

  it("ignores string literals that look like import statements", () => {
    const edges = parseImportEdges('export type IconName = | "share-from-square" | "arrow-from";');
    assert.deepEqual(edges, []);
  });
});

describe("isTypeOnlyClause", () => {
  it("detects inline type members", () => {
    assert.isTrue(isTypeOnlyClause(" {type A, type B} "));
    assert.isFalse(isTypeOnlyClause(" {type A, B} "));
  });
});

describe("parseReexports", () => {
  it("records star and named re-exports with their type flag", () => {
    const statements = parseReexports(
      [
        'export * from "./Box";',
        'export type * from "./Chart";',
        'export {A as B} from "./a";',
      ].join("\n")
    );
    assert.deepEqual(
      statements.map((statement) => [statement.specifier, statement.typeOnly, statement.entries]),
      [
        ["./Box", false, null],
        ["./Chart", true, null],
        ["./a", false, [{exported: "B", local: "A"}]],
      ]
    );
  });
});

describe("isPassThroughBarrel", () => {
  it("accepts a module of re-exports plus erased declarations", () => {
    assert.isTrue(
      isPassThroughBarrel(
        [
          'export * from "./Box";',
          "export interface Insets {top?: number;}",
          "type Id = string;",
        ].join("\n")
      )
    );
  });

  it("rejects a module with runtime code", () => {
    assert.isFalse(
      isPassThroughBarrel(['export * from "./Box";', "export const one = 1;"].join("\n"))
    );
  });

  it("rejects a module with no re-exports", () => {
    assert.isFalse(isPassThroughBarrel("export interface Insets {top?: number;}"));
  });
});

describe("runtimeSkeleton", () => {
  it("ignores comments, formatting, and type declarations", () => {
    const before = [
      "// comment",
      "export interface Props {a: string;}",
      "export const x = 1;",
    ].join("\n");
    const after = ["export interface Props {a: string; b?: number;}", "export const x = 1;"].join(
      "\n"
    );
    assert.equal(runtimeSkeleton(before), runtimeSkeleton(after));
  });

  it("keeps runtime differences", () => {
    assert.notEqual(runtimeSkeleton("export const x = 1;"), runtimeSkeleton("export const x = 2;"));
  });

  it("drops type-only imports", () => {
    assert.equal(
      runtimeSkeleton('import type {A} from "./a";\nexport const x = 1;'),
      runtimeSkeleton("export const x = 1;")
    );
  });
});

describe("stripTypeDeclarations", () => {
  it("leaves runtime declarations in place", () => {
    const stripped = stripTypeDeclarations("type A = {b: string};\nexport const c = 1;");
    assert.notInclude(stripped, "type A");
    assert.include(stripped, "export const c = 1;");
  });
});

describe("parseLocalExportNames", () => {
  it("collects declarations and export lists", () => {
    const names = parseLocalExportNames(
      ["export const a = 1;", "export interface B {}", "const c = 2;", "export {c as d};"].join(
        "\n"
      )
    );
    assert.includeMembers(names, ["a", "B", "d"]);
  });
});

describe("resolveSpecifier", () => {
  it("resolves workspace packages to their source entry", () => {
    const repoRoot = createRepo({
      "package.json": JSON.stringify({workspaces: ["ui"]}),
      "ui/package.json": JSON.stringify({
        exports: {".": {default: "./dist/index.js"}},
        name: "@x/ui",
      }),
      "ui/src/Box.tsx": "export const Box = 1;",
      "ui/src/index.tsx": 'export * from "./Box";',
    });
    const resolved = resolveSpecifier({
      fromFile: join(repoRoot, "app/screen.tsx"),
      repoRoot,
      specifier: "@x/ui",
      workspacePackages: [{dir: join(repoRoot, "ui"), name: "@x/ui"}],
    });
    assert.deepEqual(resolved, {file: join(repoRoot, "ui/src/index.tsx"), kind: "file"});
  });

  it("reports third-party packages as external", () => {
    const repoRoot = createRepo({"package.json": JSON.stringify({workspaces: []})});
    assert.deepEqual(
      resolveSpecifier({
        fromFile: join(repoRoot, "app/screen.tsx"),
        repoRoot,
        specifier: "luxon/src/thing",
        workspacePackages: [],
      }),
      {externalPackage: "luxon", kind: "external"}
    );
  });
});

describe("collectReachable", () => {
  const repoFiles = {
    "app/screen.tsx": 'import {Box} from "@x/ui";\nexport const Screen = Box;',
    "package.json": JSON.stringify({workspaces: ["ui"]}),
    "ui/package.json": JSON.stringify({
      exports: {".": {default: "./dist/index.js"}},
      name: "@x/ui",
    }),
    "ui/src/Box.tsx": 'import {helper} from "./helper";\nexport const Box = helper;',
    "ui/src/Chart.tsx": "export const Chart = 2;",
    "ui/src/helper.ts": "export const helper = 1;",
    "ui/src/index.tsx": [
      'export * from "./Box";',
      'export type * from "./Chart";',
      'export {Chart} from "./lazy";',
    ].join("\n"),
    "ui/src/lazy.tsx": [
      'import type {Chart as ChartComponent} from "./Chart";',
      'const factories = {Chart: () => import("./Chart"), Unused: () => import("./Unused")};',
      "export const Chart = factories.Chart as unknown as typeof ChartComponent;",
      "export const Unused = factories.Unused;",
    ].join("\n"),
    "ui/src/Unused.tsx": "export const Unused = 3;",
  };

  it("follows only the bindings a consumer imports", () => {
    const repoRoot = createRepo(repoFiles);
    const graph = collectReachable({repoRoot, roots: [join(repoRoot, "app/screen.tsx")]});
    assert.isTrue(graph.files.has(join(repoRoot, "ui/src/Box.tsx")));
    assert.isTrue(graph.files.has(join(repoRoot, "ui/src/helper.ts")));
    assert.isFalse(graph.files.has(join(repoRoot, "ui/src/Chart.tsx")));
    assert.isFalse(graph.unresolved, graph.unresolvedSpecifiers.join(", "));
  });

  it("follows a lazy factory when its binding is imported", () => {
    const repoRoot = createRepo({
      ...repoFiles,
      "app/screen.tsx": 'import {Chart} from "@x/ui";\nexport const Screen = Chart;',
    });
    const graph = collectReachable({repoRoot, roots: [join(repoRoot, "app/screen.tsx")]});
    assert.isTrue(graph.files.has(join(repoRoot, "ui/src/Chart.tsx")));
    assert.isFalse(graph.files.has(join(repoRoot, "ui/src/Unused.tsx")));
  });

  it("records the bindings each module is imported for", () => {
    const repoRoot = createRepo(repoFiles);
    const graph = collectReachable({repoRoot, roots: [join(repoRoot, "app/screen.tsx")]});
    assert.deepEqual(
      [...(graph.requestedNames.get(join(repoRoot, "ui/src/Box.tsx")) as Set<string>)],
      ["Box"]
    );
  });

  it("pulls everything a barrel exports when the binding cannot be traced", () => {
    const repoRoot = createRepo({
      ...repoFiles,
      "app/screen.tsx": 'import {Mystery} from "@x/ui";\nexport const Screen = Mystery;',
    });
    const graph = collectReachable({repoRoot, roots: [join(repoRoot, "app/screen.tsx")]});
    assert.equal(graph.barrels.get(join(repoRoot, "ui/src/index.tsx")), "all");
    assert.isTrue(graph.files.has(join(repoRoot, "ui/src/Chart.tsx")));
  });
});
