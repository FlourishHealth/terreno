import {existsSync, readFileSync, statSync} from "node:fs";
import {dirname, join, resolve} from "node:path";

const SRC_ROOT = resolve(import.meta.dir, "../src");
const DIST_ROOT = resolve(import.meta.dir, "../dist");

const SOURCE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

const resolveRelativeModule = (fromFile: string, specifier: string): string | null => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const basePath = resolve(dirname(fromFile), specifier);
  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(basePath, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const collectSpecifiers = (source: string): string[] => {
  const specifiers: string[] = [];
  const patterns = [
    /^\s*import\s+(?!type\b)[\s\S]*?\sfrom\s+["']([^"']+)["']/gm,
    /^\s*export\s+\*\s+from\s+["']([^"']+)["']/gm,
    /^\s*export\s+\{[^}]+\}\s+from\s+["']([^"']+)["']/gm,
    /^\s*export\s+\{default\s+as\s+\w+\}\s+from\s+["']([^"']+)["']/gm,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) {
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
};

const walkModuleGraph = ({
  entryFile,
  visited,
}: {
  entryFile: string;
  visited: Set<string>;
}): void => {
  if (visited.has(entryFile)) {
    return;
  }

  visited.add(entryFile);

  let source = "";
  try {
    source = readFileSync(entryFile, "utf8");
  } catch {
    return;
  }

  for (const specifier of collectSpecifiers(source)) {
    const resolved = resolveRelativeModule(entryFile, specifier);
    if (resolved) {
      walkModuleGraph({entryFile: resolved, visited});
    }
  }
};

export interface ImportGraphMeasurement {
  entryFile: string;
  moduleCount: number;
  modulePaths: string[];
  outputBytes: number;
}

export const measureImportGraph = (entryFile: string): ImportGraphMeasurement => {
  const visited = new Set<string>();
  walkModuleGraph({entryFile, visited});

  const modulePaths = [...visited].sort();
  const outputBytes = modulePaths.reduce((total, modulePath) => {
    try {
      return total + statSync(modulePath).size;
    } catch {
      return total;
    }
  }, 0);

  return {
    entryFile,
    moduleCount: modulePaths.length,
    modulePaths,
    outputBytes,
  };
};

export const resolvePackageEntry = (importPath: string): string => {
  if (importPath === "@terreno/ui") {
    return join(SRC_ROOT, "index.tsx");
  }

  if (importPath.startsWith("@terreno/ui/")) {
    const moduleName = importPath.slice("@terreno/ui/".length);
    const srcCandidate = join(SRC_ROOT, `${moduleName}.tsx`);
    if (existsSync(srcCandidate)) {
      return srcCandidate;
    }

    const tsCandidate = join(SRC_ROOT, `${moduleName}.ts`);
    if (existsSync(tsCandidate)) {
      return tsCandidate;
    }

    const distCandidate = join(DIST_ROOT, `${moduleName}.js`);
    if (existsSync(distCandidate)) {
      return distCandidate;
    }
  }

  throw new Error(`Unsupported import path for graph measurement: ${importPath}`);
};

export const diffImportGraphs = ({
  baselinePaths,
  comparisonPaths,
}: {
  baselinePaths: string[];
  comparisonPaths: string[];
}): string[] => {
  const comparisonSet = new Set(comparisonPaths);
  return baselinePaths.filter((modulePath) => !comparisonSet.has(modulePath));
};
