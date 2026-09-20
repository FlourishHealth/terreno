import {describe, it} from "bun:test";
import {assert} from "chai";

import {
  findTopLevelExportDeclarations,
  hasSameRequestedRuntime,
  sliceUnusedBindings,
} from "./runtimeSlice";

const REGISTRY_BEFORE = [
  'import {createLazyNamedExport} from "./createLazyComponentExport";',
  "export const factories = {",
  '  ConsentFormScreen: () => import("../ConsentFormScreen"),',
  "};",
  'export const ConsentFormScreen = createLazyNamedExport(factories.ConsentFormScreen, "ConsentFormScreen");',
].join("\n");

const REGISTRY_AFTER = [
  'import {createLazyNamedExport} from "./createLazyComponentExport";',
  "export const factories = {",
  '  AreaChart: () => import("../AreaChart"),',
  '  ConsentFormScreen: () => import("../ConsentFormScreen"),',
  "};",
  'export const AreaChart = createLazyNamedExport(factories.AreaChart, "AreaChart");',
  'export const ConsentFormScreen = createLazyNamedExport(factories.ConsentFormScreen, "ConsentFormScreen");',
].join("\n");

describe("findTopLevelExportDeclarations", () => {
  it("bounds const and function declarations", () => {
    const declarations = findTopLevelExportDeclarations(
      ["export const a = {b: 1};", "export function c() {\n  return {d: 2};\n}"].join("\n")
    );
    assert.deepEqual(
      declarations.map((declaration) => declaration.name),
      ["a", "c"]
    );
  });

  it("skips declarations nested inside a block", () => {
    const declarations = findTopLevelExportDeclarations(
      "function outer() {\n  const inner = 1;\n}"
    );
    assert.deepEqual(declarations, []);
  });
});

describe("sliceUnusedBindings", () => {
  it("drops lazy entries and exports nothing imports", () => {
    const sliced = sliceUnusedBindings({
      keep: new Set(["ConsentFormScreen"]),
      source: REGISTRY_AFTER,
    });
    assert.notInclude(sliced, "AreaChart");
    assert.include(sliced, "ConsentFormScreen");
  });

  it("keeps a helper the module still references", () => {
    const source = ["export const helper = () => 1;", "export const Used = () => helper();"].join(
      "\n"
    );
    const sliced = sliceUnusedBindings({keep: new Set(["Used"]), source});
    assert.include(sliced, "helper");
  });
});

describe("hasSameRequestedRuntime", () => {
  it("treats a new registry entry as no change for existing consumers", () => {
    assert.isTrue(
      hasSameRequestedRuntime({
        baseSource: REGISTRY_BEFORE,
        headSource: REGISTRY_AFTER,
        requestedNames: new Set(["ConsentFormScreen"]),
      })
    );
  });

  it("detects a change to a binding consumers import", () => {
    assert.isFalse(
      hasSameRequestedRuntime({
        baseSource: REGISTRY_BEFORE,
        headSource: REGISTRY_BEFORE.replace("../ConsentFormScreen", "../ConsentFormScreenV2"),
        requestedNames: new Set(["ConsentFormScreen"]),
      })
    );
  });

  it("detects module-scope side effects", () => {
    assert.isFalse(
      hasSameRequestedRuntime({
        baseSource: REGISTRY_BEFORE,
        headSource: `${REGISTRY_AFTER}\nconsole.info("boot");`,
        requestedNames: new Set(["ConsentFormScreen"]),
      })
    );
  });
});
