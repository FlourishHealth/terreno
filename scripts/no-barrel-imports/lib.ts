import {existsSync, readdirSync, readFileSync, statSync} from "node:fs";
import {basename, dirname, join, relative, resolve} from "node:path";

export const REPO_ROOT = resolve(import.meta.dir, "../..");

export const SCAN_ROOTS = [
  "admin-backend/src",
  "admin-frontend/src",
  "admin-spa",
  "ai/src",
  "api/src",
  "api-health/src",
  "demo",
  "example-backend/src",
  "example-frontend",
  "feature-flags/src",
  "mcp-server/src",
  "rtk/src",
  "test/src",
  "ui/src",
] as const;

export const PACKAGE_SCAN_ROOTS: Record<string, readonly string[]> = {
  "admin-backend": ["admin-backend/src"],
  "admin-frontend": ["admin-frontend/src"],
  "admin-spa": ["admin-spa"],
  ai: ["ai/src"],
  api: ["api/src"],
  "api-health": ["api-health/src"],
  demo: ["demo"],
  "example-backend": ["example-backend/src"],
  "example-frontend": ["example-frontend"],
  "feature-flags": ["feature-flags/src"],
  "mcp-server": ["mcp-server/src"],
  rtk: ["rtk/src"],
  test: ["test/src"],
  ui: ["ui/src"],
};

const PACKAGES_WITH_PATH_ALIASES = new Set(["example-frontend", "admin-spa", "demo"]);

export const INTERNAL_ALIAS_BARRELS = [
  "@/store",
  "@store",
  "@components",
  "@utils",
  "@stories",
  "@assets",
  "@app",
  "@constants",
] as const;

const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".expo",
  ".next",
  "generated",
  "vendor",
]);

/** Package name → absolute path to the package public entry index file. */
export const PACKAGE_PUBLIC_ENTRIES: Record<string, string> = {
  "@terreno/admin-backend": resolve(REPO_ROOT, "admin-backend/src/index.ts"),
  "@terreno/admin-frontend": resolve(REPO_ROOT, "admin-frontend/src/index.tsx"),
  "@terreno/admin-spa": resolve(REPO_ROOT, "admin-spa/src/index.ts"),
  "@terreno/ai": resolve(REPO_ROOT, "ai/src/index.ts"),
  "@terreno/api": resolve(REPO_ROOT, "api/src/index.ts"),
  "@terreno/api-health": resolve(REPO_ROOT, "api-health/src/index.ts"),
  "@terreno/feature-flags": resolve(REPO_ROOT, "feature-flags/src/index.ts"),
  "@terreno/mcp": resolve(REPO_ROOT, "mcp-server/src/index.ts"),
  "@terreno/rtk": resolve(REPO_ROOT, "rtk/src/index.ts"),
  "@terreno/test": resolve(REPO_ROOT, "test/src/index.ts"),
  "@terreno/ui": resolve(REPO_ROOT, "ui/src/index.tsx"),
};

const IMPORT_EXPORT_PATTERN =
  /\b(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+\s+from\s+)?["']([^"']+)["']/g;

const REEXPORT_PATTERN = /^\s*export\s+(?:type\s+)?(?:\*|\{[^}]+\})\s+from\s+["']\./m;

export interface BarrelViolation {
  file: string;
  importPath: string;
  line: number;
  resolvedBarrel: string;
}

export interface PathAliasMap {
  [alias: string]: string[];
}

const isSourceFile = (filePath: string): boolean => /\.(t|j)sx?$/.test(filePath);

const shouldSkipDirectory = (dirName: string): boolean => {
  return IGNORED_DIR_NAMES.has(dirName) || dirName.startsWith(".");
};

export const walkSourceFiles = (directory: string, files: string[] = []): string[] => {
  if (!existsSync(directory)) {
    return files;
  }

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (shouldSkipDirectory(entry)) {
        continue;
      }
      walkSourceFiles(fullPath, files);
      continue;
    }
    if (isSourceFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
};

const readTsconfigPathAliases = (packageDir: string): PathAliasMap => {
  const tsconfigPath = join(packageDir, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    return {};
  }

  try {
    const raw = readFileSync(tsconfigPath, "utf8");
    const withoutLineComments = raw.replace(/^\s*\/\/.*$/gm, "");
    const withoutTrailingCommas = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(withoutTrailingCommas) as {
      compilerOptions?: {baseUrl?: string; paths?: Record<string, string[]>};
    };
    const baseUrl = parsed.compilerOptions?.baseUrl ?? ".";
    const paths = parsed.compilerOptions?.paths ?? {};
    const resolved: PathAliasMap = {};

    for (const [aliasPattern, targets] of Object.entries(paths)) {
      const alias = aliasPattern.replace(/\/\*$/, "");
      resolved[alias] = targets.map((target) =>
        resolve(packageDir, baseUrl, target.replace(/\/\*$/, ""))
      );
    }

    return resolved;
  } catch {
    return {};
  }
};

export const loadPathAliases = (repoRoot: string = REPO_ROOT): Map<string, PathAliasMap> => {
  const packagesWithAliases = ["example-frontend", "admin-spa", "demo"];
  const aliasByPackageDir = new Map<string, PathAliasMap>();

  for (const pkg of packagesWithAliases) {
    aliasByPackageDir.set(resolve(repoRoot, pkg), readTsconfigPathAliases(resolve(repoRoot, pkg)));
  }

  return aliasByPackageDir;
};

const findOwningPackageDir = (filePath: string, repoRoot: string): string | null => {
  let current = dirname(filePath);
  while (current.startsWith(repoRoot)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return null;
};

export const resolveImportBase = (
  importPath: string,
  fromFile: string,
  aliasByPackageDir: Map<string, PathAliasMap>,
  repoRoot: string = REPO_ROOT
): string | null => {
  if (importPath.startsWith("@terreno/")) {
    const entry = PACKAGE_PUBLIC_ENTRIES[importPath.split("/testing")[0] ?? importPath];
    if (importPath.endsWith("/testing")) {
      const testingEntry: Record<string, string> = {
        "@terreno/api": resolve(repoRoot, "api/src/tests.ts"),
      };
      return testingEntry[importPath] ?? null;
    }
    return entry ?? null;
  }

  if (importPath.startsWith("@/")) {
    const packageDir = findOwningPackageDir(fromFile, repoRoot);
    if (!packageDir) {
      return null;
    }
    const aliases = aliasByPackageDir.get(packageDir) ?? {};
    const remainder = importPath.slice(2);
    const rootAlias = aliases["@"]?.[0];
    if (!rootAlias) {
      return null;
    }
    return resolve(rootAlias, remainder);
  }

  if (importPath.startsWith("@")) {
    const packageDir = findOwningPackageDir(fromFile, repoRoot);
    if (!packageDir) {
      return null;
    }
    const aliases = aliasByPackageDir.get(packageDir) ?? {};
    for (const [alias, targets] of Object.entries(aliases)) {
      if (importPath === alias || importPath.startsWith(`${alias}/`)) {
        const targetRoot = targets[0];
        if (!targetRoot) {
          return null;
        }
        const suffix = importPath.slice(alias.length).replace(/^\//, "");
        return suffix ? resolve(targetRoot, suffix) : targetRoot;
      }
    }
    return null;
  }

  if (!importPath.startsWith(".")) {
    return null;
  }

  return resolve(dirname(fromFile), importPath);
};

export const resolveModulePath = (basePath: string): string | null => {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
};

const isExpoRouteIndex = (filePath: string): boolean => {
  return /\/app\//.test(filePath) && /\/index\.tsx?$/.test(filePath);
};

const isPackagePublicEntry = (filePath: string): boolean => {
  return Object.values(PACKAGE_PUBLIC_ENTRIES).includes(filePath);
};

export const isBarrelIndexFile = (filePath: string): boolean => {
  if (!/\/index\.tsx?$/.test(filePath)) {
    return false;
  }
  if (isExpoRouteIndex(filePath)) {
    return false;
  }
  if (isPackagePublicEntry(filePath)) {
    return false;
  }

  const contents = readFileSync(filePath, "utf8");
  if (!REEXPORT_PATTERN.test(contents)) {
    return false;
  }

  return true;
};

const isAllowedPublicPackageImport = (importPath: string, resolvedPath: string): boolean => {
  if (!importPath.startsWith("@terreno/")) {
    return false;
  }
  if (importPath === "@terreno/api/testing") {
    return resolve(REPO_ROOT, "api/src/tests.ts") === resolvedPath;
  }
  const publicEntry = PACKAGE_PUBLIC_ENTRIES[importPath];
  return publicEntry === resolvedPath;
};

const findViolationsInFile = (
  filePath: string,
  aliasByPackageDir: Map<string, PathAliasMap>,
  repoRoot: string
): BarrelViolation[] => {
  const contents = readFileSync(filePath, "utf8");
  const lines = contents.split("\n");
  const violations: BarrelViolation[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) {
      continue;
    }

    for (const match of line.matchAll(IMPORT_EXPORT_PATTERN)) {
      const importPath = match[1];
      if (!importPath) {
        continue;
      }

      const base = resolveImportBase(importPath, filePath, aliasByPackageDir, repoRoot);
      if (!base) {
        continue;
      }

      const resolved = resolveModulePath(base);
      if (!resolved || !isBarrelIndexFile(resolved)) {
        continue;
      }

      if (isAllowedPublicPackageImport(importPath, resolved)) {
        continue;
      }

      violations.push({
        file: relative(repoRoot, filePath),
        importPath,
        line: lineIndex + 1,
        resolvedBarrel: relative(repoRoot, resolved),
      });
    }
  }

  return violations;
};

export const collectBarrelImportViolations = (
  repoRoot: string = REPO_ROOT,
  scanRoots: readonly string[] = SCAN_ROOTS
): BarrelViolation[] => {
  const aliasByPackageDir = loadPathAliases(repoRoot);
  const files: string[] = [];

  for (const scanRoot of scanRoots) {
    walkSourceFiles(resolve(repoRoot, scanRoot), files);
  }

  const violations: BarrelViolation[] = [];
  for (const file of files) {
    if (isBarrelIndexFile(file)) {
      continue;
    }
    if (isPackagePublicEntry(file)) {
      continue;
    }
    violations.push(...findViolationsInFile(file, aliasByPackageDir, repoRoot));
  }

  return violations.sort((a, b) => {
    if (a.file === b.file) {
      return a.line - b.line;
    }
    return a.file.localeCompare(b.file);
  });
};

export const collectInternalBarrelIndexFiles = (
  repoRoot: string = REPO_ROOT,
  scanRoots: readonly string[] = SCAN_ROOTS
): string[] => {
  const files: string[] = [];
  for (const scanRoot of scanRoots) {
    walkSourceFiles(resolve(repoRoot, scanRoot), files);
  }

  return files
    .filter((file) => isBarrelIndexFile(file))
    .map((file) => relative(repoRoot, file))
    .sort();
};

export const collectBarrelImportSpecifiers = (
  repoRoot: string = REPO_ROOT,
  scanRoots: readonly string[] = SCAN_ROOTS,
  options: {includePathAliases?: boolean} = {}
): string[] => {
  const includePathAliases = options.includePathAliases ?? true;
  const specifiers = new Set<string>(
    includePathAliases ? INTERNAL_ALIAS_BARRELS : []
  );

  for (const barrelRelative of collectInternalBarrelIndexFiles(repoRoot, scanRoots)) {
    const barrelDir = dirname(barrelRelative).replace(/\\/g, "/");
    const scanRoot = scanRoots.find(
      (root) => barrelDir === root || barrelDir.startsWith(`${root}/`)
    );
    if (!scanRoot) {
      continue;
    }

    const pathFromScanRoot =
      barrelDir === scanRoot ? "" : barrelDir.slice(scanRoot.length + 1);
    if (!pathFromScanRoot) {
      continue;
    }

    const parts = pathFromScanRoot.split("/");
    for (let start = 0; start < parts.length; start++) {
      const suffix = parts.slice(start).join("/");
      specifiers.add(`./${suffix}`);
      for (let depth = 1; depth <= 4; depth++) {
        specifiers.add(`${"../".repeat(depth)}${suffix}`);
      }
    }
  }

  return [...specifiers].sort();
};

export const collectBarrelImportSpecifiersByPackage = (
  repoRoot: string = REPO_ROOT
): Map<string, string[]> => {
  const specifiersByPackage = new Map<string, string[]>();

  for (const [packageName, scanRoots] of Object.entries(PACKAGE_SCAN_ROOTS)) {
    specifiersByPackage.set(
      packageName,
      collectBarrelImportSpecifiers(repoRoot, scanRoots, {
        includePathAliases: PACKAGES_WITH_PATH_ALIASES.has(packageName),
      })
    );
  }

  return specifiersByPackage;
};

const escapeGritStringLiteral = (value: string): string => {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
};

export const renderNoBarrelImportsGritPlugin = (
  specifiers: string[],
  packageName?: string
): string => {
  if (specifiers.length === 0) {
    return `// Generated by scripts/no-barrel-imports/generate-grit.ts — do not edit by hand.
// Package: ${packageName ?? "unknown"} — no barrel import specifiers.
`;
  }

  const literalLines = specifiers.flatMap((specifier) => {
    const escaped = escapeGritStringLiteral(specifier);
    return [`        \`'${escaped}'\`,`, `        \`"${specifier.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"\`,`];
  });

  return `// Generated by scripts/no-barrel-imports/generate-grit.ts — do not edit by hand.
// Package: ${packageName ?? "unknown"}
or {
    \`import $_ from $source\`,
    \`export $_ from $source\`
} where {
    $source <: or {
${literalLines.join("\n")}
    },
    register_diagnostic(
        span = $source,
        message = "Do not import through internal barrel index files. Import the concrete module path instead (see docs/explanation/no-barrel-imports.md).",
        severity = "error"
    )
}
`;
};

export const renderAllNoBarrelImportsGritPlugins = (
  repoRoot: string = REPO_ROOT
): Map<string, string> => {
  const rendered = new Map<string, string>();
  for (const [packageName, specifiers] of collectBarrelImportSpecifiersByPackage(repoRoot)) {
    rendered.set(packageName, renderNoBarrelImportsGritPlugin(specifiers, packageName));
  }
  return rendered;
};
