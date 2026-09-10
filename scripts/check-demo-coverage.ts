#!/usr/bin/env bun
/**
 * Fails when a PascalCase component exported from ui/src/index.tsx has neither
 * a demo story registration nor an allowlist reason.
 */
import {existsSync, readdirSync, readFileSync} from "node:fs";
import {dirname, join} from "node:path";

export interface AllowlistEntry {
  name: string;
  reason: string;
}

export const isComponentExportName = (name: string): boolean => {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    return false;
  }
  if (/^[A-Z0-9_]+$/.test(name)) {
    return false;
  }
  return true;
};

const splitNamedExports = (inner: string): string[] => {
  return inner
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return "";
      }
      const alias = trimmed.split(/\s+as\s+/);
      return (alias[alias.length - 1] ?? "").trim();
    })
    .filter(Boolean);
};

const parseFileValueExports = (source: string): string[] => {
  const names: string[] = [];
  for (const match of source.matchAll(/^export (?:const|function|class) (\w+)/gm)) {
    names.push(match[1] ?? "");
  }
  for (const match of source.matchAll(/^export \{([^}]+)\}/gm)) {
    const lineStart = source.lastIndexOf("\n", match.index ?? 0) + 1;
    const line = source.slice(lineStart, source.indexOf("\n", match.index ?? 0));
    if (line.includes("export type")) {
      continue;
    }
    names.push(...splitNamedExports(match[1] ?? ""));
  }
  return names.filter(Boolean);
};

export const parseIndexComponentExports = (
  indexSource: string,
  readModule: (indexRelativePath: string) => string
): string[] => {
  const names = new Set<string>();

  for (const match of indexSource.matchAll(/^export \{([^}]*)\} from "\.\/([^"]+)";/gm)) {
    for (const name of splitNamedExports(match[1] ?? "")) {
      if (isComponentExportName(name)) {
        names.add(name);
      }
    }
  }

  for (const match of indexSource.matchAll(/^export \{\n([^}]*)\} from "\.\/([^"]+)";/gm)) {
    for (const name of splitNamedExports(match[1] ?? "")) {
      if (isComponentExportName(name)) {
        names.add(name);
      }
    }
  }

  for (const match of indexSource.matchAll(/^export \* from "\.\/([^"]+)";/gm)) {
    const rel = match[1] ?? "";
    const moduleSource = readModule(rel);
    for (const name of parseFileValueExports(moduleSource)) {
      if (isComponentExportName(name)) {
        names.add(name);
      }
    }
  }

  return [...names];
};

export const parseRegisteredComponents = (
  _demoConfigSource: string,
  storyConfigSources: Record<string, string>
): Set<string> => {
  const registered = new Set<string>();
  for (const [file, source] of Object.entries(storyConfigSources)) {
    const fromFile = file.replace(/\.config\.tsx$/, "");
    if (isComponentExportName(fromFile)) {
      registered.add(fromFile);
    }
    for (const match of source.matchAll(/\bcomponent:\s*([A-Za-z][A-Za-z0-9]*)/g)) {
      const name = match[1] ?? "";
      if (isComponentExportName(name)) {
        registered.add(name);
      }
    }
    for (const match of source.matchAll(/\bname:\s*"([^"]+)"/g)) {
      const compact = (match[1] ?? "").replace(/[^A-Za-z0-9]/g, "");
      if (isComponentExportName(compact)) {
        registered.add(compact);
      }
    }
  }
  if (_demoConfigSource.includes("OpenAPIContextConfiguration")) {
    registered.add("OpenAPIContext");
    registered.add("OpenAPIProvider");
  }
  return registered;
};

export const parseAllowlist = (entries: AllowlistEntry[]): Map<string, string> => {
  const allowlist = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.reason.trim()) {
      throw new Error(`Allowlist entry "${entry.name}" is missing a reason`);
    }
    allowlist.set(entry.name, entry.reason);
  }
  return allowlist;
};

export interface CoveragePass {
  ok: true;
}

export interface CoverageFail {
  missing: string[];
  ok: false;
}

export const evaluateDemoCoverage = ({
  exported,
  registered,
  allowlist,
}: {
  exported: string[];
  registered: Set<string>;
  allowlist: Map<string, string>;
}): CoveragePass | CoverageFail => {
  const missing = exported.filter((name) => !registered.has(name) && !allowlist.has(name)).sort();
  if (missing.length > 0) {
    return {missing, ok: false};
  }
  return {ok: true};
};

/**
 * Each entry needs a specific reason — not "hard to demo".
 * Keep this list shrinking as stories land (tasks 2.1 / 2.2).
 */
export const DEMO_COVERAGE_ALLOWLIST: AllowlistEntry[] = [
  {name: "BarsFilterIcon", reason: "P2 — icon primitive; Icon story covers the icon set"},
  {name: "ConsentNavigator", reason: "P2 — ConsentFormScreen already demos consent"},
  {name: "DateTimeActionSheet", reason: "P2 — DateTimeField already demos the picker"},
  {name: "DecimalRangeActionSheet", reason: "P2 — uncommon picker sheet"},
  {name: "DraggableList", reason: "P2 — uncommon list"},
  {name: "FilterAccordion", reason: "P2 — Filter story already covers the filter pattern"},
  {name: "FilterBoolean", reason: "P2 — Filter story already covers the filter pattern"},
  {name: "FilterChangesBadge", reason: "P2 — Filter story already covers the filter pattern"},
  {name: "FilterSelectMenu", reason: "P2 — Filter story already covers the filter pattern"},
  {name: "FlatList", reason: "P2 — React Native list wrapper, not a visual design component"},
  {name: "GPTMemoryModal", reason: "P2 — GPTChat sub-surface"},
  {name: "HeightActionSheet", reason: "P2 — HeightField already demos the picker"},
  {name: "Host", reason: "Portal host is application shell, not a visual story"},
  {name: "IconRegistryProvider", reason: "Icon registry is application shell"},
  {name: "NumberPickerActionSheet", reason: "P2 — uncommon picker sheet"},
  {name: "Portal", reason: "Portal is a host primitive, not a visual story"},
  {name: "PortalContext", reason: "React context object, not a visual component"},
  {name: "Radio", reason: "P2 — RadioField already demos radio selection"},
  {name: "ScrollView", reason: "P2 — React Native scroll wrapper, not a visual design component"},
  {name: "SidebarNavigationPanel", reason: "Covered by the Sidebar navigation stories"},
  {name: "Signature", reason: "P2 — SignatureField already demos capture"},
  {name: "Swiper", reason: "P2 — onboarding helper"},
  {name: "TableContextProvider", reason: "Table stories already wrap table context"},
  {name: "TableHeader", reason: "P2 — Table story already covers table layout"},
  {name: "TableHeaderCell", reason: "P2 — Table story already covers table layout"},
  {name: "TableRow", reason: "P2 — Table story already covers table layout"},
  {name: "TerrenoProvider", reason: "Demo root already wraps the app"},
  {name: "ThemeContext", reason: "React context object, not a visual component"},
  {name: "ThemeProvider", reason: "Theme story already exercises theme; provider is shell"},
  {name: "Unifier", reason: "Platform utility singleton, not a component"},
  {name: "UpgradeRequiredScreen", reason: "P2 — uncommon blocking screen"},
];

const repoRootFromMeta = (): string => join(dirname(new URL(import.meta.url).pathname), "..");

const readUiModule = (repoRoot: string, indexRelativePath: string): string => {
  const base = join(repoRoot, "ui/src", indexRelativePath);
  const candidates = [`${base}.tsx`, `${base}.ts`, join(base, "index.tsx"), join(base, "index.ts")];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    return "";
  }
  return readFileSync(path, "utf8");
};

export const runDemoCoverageCheck = (
  repoRoot: string = repoRootFromMeta()
): CoveragePass | CoverageFail => {
  const indexSource = readFileSync(join(repoRoot, "ui/src/index.tsx"), "utf8");
  const demoConfigSource = readFileSync(join(repoRoot, "demo/demoConfig.tsx"), "utf8");
  const storyDir = join(repoRoot, "demo/story-config");
  const storyConfigSources: Record<string, string> = {};
  for (const file of readdirSync(storyDir)) {
    if (!file.endsWith(".config.tsx")) {
      continue;
    }
    storyConfigSources[file] = readFileSync(join(storyDir, file), "utf8");
  }
  const exported = parseIndexComponentExports(indexSource, (rel) => readUiModule(repoRoot, rel));
  const registered = parseRegisteredComponents(demoConfigSource, storyConfigSources);
  const allowlist = parseAllowlist(DEMO_COVERAGE_ALLOWLIST);
  return evaluateDemoCoverage({allowlist, exported, registered});
};

const main = (): void => {
  const result = runDemoCoverageCheck();
  if (!result.ok) {
    console.error("check-demo-coverage: unstoried components with no allowlist reason:");
    for (const name of result.missing) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }
  console.info("check-demo-coverage: every exported component has a story or an allowlist reason");
};

if (import.meta.main) {
  main();
}
