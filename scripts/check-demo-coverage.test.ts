import {describe, expect, it} from "bun:test";

import {
  DEMO_COVERAGE_ALLOWLIST,
  evaluateDemoCoverage,
  isComponentExportName,
  parseAllowlist,
  parseIndexComponentExports,
  parseRegisteredComponents,
  runDemoCoverageCheck,
} from "./check-demo-coverage";

describe("isComponentExportName", () => {
  it("accepts PascalCase component names", () => {
    expect(isComponentExportName("GPTChat")).toBe(true);
    expect(isComponentExportName("SocialLoginButton")).toBe(true);
  });

  it("rejects hooks, constants, and non-identifiers", () => {
    expect(isComponentExportName("useTheme")).toBe(false);
    expect(isComponentExportName("SPACING_MAP")).toBe(false);
    expect(isComponentExportName("hideBanner")).toBe(false);
  });
});

describe("parseIndexComponentExports", () => {
  it("reads named value exports and star-exported components", () => {
    const files: Record<string, string> = {
      "ui/src/Button.tsx": "export const Button = () => null;\n",
      "ui/src/SplitPage.tsx": "export const SplitPage = () => null;\nexport const helper = 1;\n",
    };
    const index = `
export type {StyleProp} from "react-native";
export * from "./Button";
export {SplitPage} from "./SplitPage";
export type * from "./GPTChat";
export {hideBanner, Banner} from "./Banner";
`;
    const names = parseIndexComponentExports(index, (rel) => files[`ui/src/${rel}.tsx`] ?? "");
    expect(names.sort()).toEqual(["Banner", "Button", "SplitPage"]);
  });
});

describe("parseRegisteredComponents", () => {
  it("reads component identifiers from story-config sources", () => {
    const registered = parseRegisteredComponents(
      `import {ButtonConfiguration} from "@story-config/Button.config";
const Config = [ButtonConfiguration];`,
      {
        "Button.config.tsx": `export const ButtonConfiguration = { name: "Button", component: Button,`,
        "TableBadge.config.tsx": `export const TableBadgeConfiguration = { name: "Table badge", component: Table,`,
      }
    );
    expect(registered.has("Button")).toBe(true);
    expect(registered.has("TableBadge")).toBe(true);
  });
});

describe("parseAllowlist", () => {
  it("requires a non-empty reason for each entry", () => {
    expect(() => parseAllowlist([{name: "Host", reason: ""}])).toThrow(/reason/);
    expect(parseAllowlist([{name: "Host", reason: "Portal host is app shell"}]).has("Host")).toBe(
      true
    );
  });
});

describe("evaluateDemoCoverage", () => {
  it("fails with the unstoried component name when an export has no story and no allowlist", () => {
    const result = evaluateDemoCoverage({
      allowlist: new Map(),
      exported: ["GPTChat", "Button"],
      registered: new Set(["Button"]),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.missing).toEqual(["GPTChat"]);
  });

  it("passes when every export has a story or an allowlist reason", () => {
    const result = evaluateDemoCoverage({
      allowlist: new Map([["Host", "Portal host is app shell"]]),
      exported: ["GPTChat", "Host"],
      registered: new Set(["GPTChat"]),
    });
    expect(result.ok).toBe(true);
  });
});

describe("DEMO_COVERAGE_ALLOWLIST", () => {
  it("gives every entry a non-empty reason", () => {
    expect(DEMO_COVERAGE_ALLOWLIST.length).toBeGreaterThan(0);
    for (const entry of DEMO_COVERAGE_ALLOWLIST) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("runDemoCoverageCheck", () => {
  it("passes against the current ui index, demo registrations, and allowlist", () => {
    expect(runDemoCoverageCheck().ok).toBe(true);
  });
});
