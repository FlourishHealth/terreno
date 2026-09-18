/**
 * Source-level import graph used to decide whether a change can reach the
 * Playwright e2e surface.
 *
 * The graph resolves named imports through re-export barrels so that adding a
 * component to `@terreno/ui` does not make every consumer of that package look
 * affected. Anything the parser cannot resolve is treated as "reaches
 * everything" so the gate fails open (runs e2e) instead of hiding a real break.
 */
import {existsSync, readFileSync, statSync} from "node:fs";
import {dirname, isAbsolute, join, relative, resolve} from "node:path";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/** Package-root aliases used by the Expo apps (`@/store/x`, `@store/x`). */
const ROOT_ALIASES = [
  "@/",
  "@app/",
  "@assets/",
  "@components/",
  "@constants/",
  "@store/",
  "@utils/",
];

const LINE_COMMENT = /\/\/[^\n]*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

// The clause cannot contain a quote or semicolon, so a match never spans more
// than one statement.
const FROM_STATEMENT = /\b(?:import|export)\b([^;"'`]*?)\bfrom\s*["']([^"']+)["']\s*;?/g;
const BARE_IMPORT = /\bimport\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE_CALL = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
const KEYED_LAZY_IMPORT =
  /([A-Za-z0-9_$]+)\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["']([^"']+)["']\s*\)/g;
const REEXPORT_STATEMENT =
  /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z0-9_$]+)?|\{[^}]*\})\s*from\s*["'][^"']+["']\s*;?/g;

export interface ImportEdge {
  /**
   * Object-literal key for a lazy factory (`Chart: () => import("./Chart")`).
   * Such a module only loads when that binding is used.
   */
  key?: string;
  /** Imported binding names, or null when the whole module is pulled in. */
  names: string[] | null;
  specifier: string;
  /** Type-only imports are erased at build time and carry no runtime edge. */
  typeOnly?: boolean;
}

interface ReexportEntry {
  exported: string;
  local: string;
}

export interface ReexportStatement {
  /** Named re-exports, or null for `export * from "..."`. */
  entries: ReexportEntry[] | null;
  specifier: string;
  /** `export type ...` republishes types only; no runtime edge. */
  typeOnly: boolean;
}

export interface WorkspacePackage {
  dir: string;
  name: string;
}

export type ResolvedSpecifier =
  | {externalPackage: string; kind: "external"}
  | {file: string; kind: "file"}
  | {kind: "unresolved"};

export interface ReachableGraph {
  /** Barrel files reached, mapped to the binding names consumers asked for. */
  barrels: Map<string, Set<string> | "all">;
  /** Bare package specifiers imported by reachable source. */
  externalPackages: Set<string>;
  /** Non-barrel source files reachable from the roots. */
  files: Set<string>;
  /** Bindings each reachable module is imported for ("all" when unknown). */
  requestedNames: Map<string, Set<string> | "all">;
  /** True when something could not be resolved, so callers must fail open. */
  unresolved: boolean;
  /** `importer -> specifier` pairs behind `unresolved`, for diagnostics. */
  unresolvedSpecifiers: string[];
}

/**
 * Module specifiers never contain whitespace or interpolation. The scanner is
 * regex based, so string literals such as `"arrow-up-from-bracket"` can look
 * like an import; those matches are dropped rather than reported as
 * unresolved.
 */
const PLAUSIBLE_SPECIFIER = /^[@\w./~-]+$/;

const isPlausibleSpecifier = (specifier: string): boolean =>
  specifier.length > 0 && PLAUSIBLE_SPECIFIER.test(specifier);

export const stripComments = (source: string): string =>
  source.replace(BLOCK_COMMENT, " ").replace(LINE_COMMENT, " ");

const splitNames = (inner: string): string[] => {
  const names: string[] = [];
  for (const part of inner.split(",")) {
    const name = part
      .trim()
      .replace(/^type\s+/, "")
      .split(/\s+as\s+/)[0]
      ?.trim();
    if (name) {
      names.push(name);
    }
  }
  return names;
};

/** Binding names an import clause pulls from its target, or null for "all". */
export const parseImportClause = (clause: string): string[] | null => {
  const trimmed = clause.replace(/^\s*type\s+/, "").trim();
  if (trimmed.includes("*")) {
    return null;
  }
  // A clause carrying statement punctuation means the scanner spanned more
  // than one statement; pull the whole module instead of guessing names.
  if (/[;=()]/.test(trimmed)) {
    return null;
  }
  const braceStart = trimmed.indexOf("{");
  if (braceStart === -1) {
    // `import Foo from "x"` (default) or a clause shape we do not model.
    return trimmed.length > 0 ? ["default"] : null;
  }
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceEnd < braceStart) {
    return null;
  }
  const names = splitNames(trimmed.slice(braceStart + 1, braceEnd));
  const beforeBrace = trimmed.slice(0, braceStart).replace(/,\s*$/, "").trim();
  if (beforeBrace.length > 0) {
    names.push("default");
  }
  return names;
};

/** True for `import type {A}` / `export type {A}` / `import {type A, type B}`. */
export const isTypeOnlyClause = (clause: string): boolean => {
  const trimmed = clause.trim();
  if (trimmed.includes(";")) {
    // The scanner spanned more than one statement; do not treat it as erased.
    return false;
  }
  if (/^type\b/.test(trimmed)) {
    return true;
  }
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart === -1 || braceEnd < braceStart) {
    return false;
  }
  if (trimmed.slice(0, braceStart).replace(/,\s*$/, "").trim().length > 0) {
    return false;
  }
  const members = trimmed
    .slice(braceStart + 1, braceEnd)
    .split(",")
    .map((member) => member.trim())
    .filter((member) => member.length > 0);
  return members.length > 0 && members.every((member) => /^type\s/.test(member));
};

export const parseImportEdges = (source: string): ImportEdge[] => {
  const clean = stripComments(source);
  const edges: ImportEdge[] = [];
  for (const match of clean.matchAll(FROM_STATEMENT)) {
    const clause = match[1] ?? "";
    edges.push({
      names: parseImportClause(clause),
      specifier: match[2] ?? "",
      typeOnly: isTypeOnlyClause(clause),
    });
  }
  const keyedSpecifiers = new Set<string>();
  for (const match of clean.matchAll(KEYED_LAZY_IMPORT)) {
    const key = match[1];
    const specifier = match[2];
    if (!key || !specifier) {
      continue;
    }
    keyedSpecifiers.add(specifier);
    edges.push({key, names: null, specifier});
  }
  for (const pattern of [BARE_IMPORT, DYNAMIC_IMPORT, REQUIRE_CALL]) {
    for (const match of clean.matchAll(pattern)) {
      const specifier = match[1] ?? "";
      if (keyedSpecifiers.has(specifier)) {
        continue;
      }
      edges.push({names: null, specifier});
    }
  }
  return edges.filter((edge) => isPlausibleSpecifier(edge.specifier));
};

export const parseReexports = (source: string): ReexportStatement[] => {
  const clean = stripComments(source);
  const statements: ReexportStatement[] = [];
  for (const match of clean.matchAll(REEXPORT_STATEMENT)) {
    const statement = match[0];
    const specifier = statement.match(/from\s*["']([^"']+)["']/)?.[1];
    if (!specifier || !isPlausibleSpecifier(specifier)) {
      continue;
    }
    const typeOnly =
      /\bexport\s+type\b/.test(statement) ||
      isTypeOnlyClause(statement.slice(statement.indexOf("export") + "export".length));
    if (/\bexport\s+(?:type\s+)?\*/.test(statement)) {
      // `export * as ns from "x"` publishes one namespace binding, not the
      // module's names; treat it as an opaque pull of the whole module.
      const namespaceAlias = statement.match(/\*\s+as\s+([A-Za-z0-9_$]+)/)?.[1];
      statements.push({
        entries: namespaceAlias ? [{exported: namespaceAlias, local: "*"}] : null,
        specifier,
        typeOnly,
      });
      continue;
    }
    const inner = statement.slice(statement.indexOf("{") + 1, statement.lastIndexOf("}"));
    const entries: ReexportEntry[] = [];
    for (const part of inner.split(",")) {
      const cleaned = part.trim().replace(/^type\s+/, "");
      if (!cleaned) {
        continue;
      }
      const [local, exported] = cleaned.split(/\s+as\s+/).map((piece) => piece.trim());
      entries.push({exported: exported ?? local ?? "", local: local ?? ""});
    }
    statements.push({entries, specifier, typeOnly});
  }
  return statements;
};

const TYPE_DECLARATION = /\b(?:export\s+)?(?:interface\s+[A-Za-z0-9_$]+|type\s+[A-Za-z0-9_$]+)/g;

const CLOSERS: Record<string, string> = {"(": ")", "[": "]", "{": "}"};

/**
 * Removes `interface X {...}` and `type X = ...;` declarations, which are
 * erased at build time. Anything the scanner cannot bound is left in place.
 */
export const stripTypeDeclarations = (source: string): string => {
  let result = source;
  TYPE_DECLARATION.lastIndex = 0;
  let match = TYPE_DECLARATION.exec(result);
  while (match !== null) {
    const start = match.index;
    const isInterface = /\binterface\b/.test(match[0]);
    const stack: string[] = [];
    let end = -1;
    for (let index = start + match[0].length; index < result.length; index += 1) {
      const character = result[index] ?? "";
      if (CLOSERS[character]) {
        stack.push(CLOSERS[character]);
        continue;
      }
      if (stack.length > 0 && character === stack[stack.length - 1]) {
        stack.pop();
        if (isInterface && stack.length === 0 && character === "}") {
          end = index + 1;
          break;
        }
        continue;
      }
      if (!isInterface && stack.length === 0 && character === ";") {
        end = index + 1;
        break;
      }
    }
    if (end === -1) {
      TYPE_DECLARATION.lastIndex = start + match[0].length;
      match = TYPE_DECLARATION.exec(result);
      continue;
    }
    result = `${result.slice(0, start)} ${result.slice(end)}`;
    TYPE_DECLARATION.lastIndex = start;
    match = TYPE_DECLARATION.exec(result);
  }
  return result;
};

/** Removes `import type ...` / `export type ... from` statements. */
const stripTypeOnlyImports = (source: string): string =>
  source.replace(FROM_STATEMENT, (statement, clause: string) =>
    isTypeOnlyClause(clause) ? " " : statement
  );

/**
 * Normalised runtime content of a module: comments, type declarations, and
 * formatting removed. Two revisions with the same skeleton cannot behave
 * differently at runtime.
 */
export const runtimeSkeleton = (source: string): string =>
  stripTypeOnlyImports(stripTypeDeclarations(stripAmbientDeclarations(stripComments(source))))
    .replace(/\s+/g, " ")
    .replace(/(?:\s*;\s*)+/g, ";")
    .trim();

const RUNTIME_TOKEN =
  /\b(?:const|let|var|function|class|enum|namespace|new|await|require|import)\b|=>/;

const DECLARE_KEYWORD = /\b(?:export\s+)?declare\b/g;

/** Removes ambient `declare` statements and blocks, which emit no runtime. */
const stripAmbientDeclarations = (source: string): string => {
  let result = source;
  DECLARE_KEYWORD.lastIndex = 0;
  let match = DECLARE_KEYWORD.exec(result);
  while (match !== null) {
    const start = match.index;
    let depth = 0;
    let sawBrace = false;
    let end = result.length;
    for (let index = start; index < result.length; index += 1) {
      const character = result[index];
      if (character === "{") {
        depth += 1;
        sawBrace = true;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0 && sawBrace) {
          end = index + 1;
          break;
        }
      } else if (character === ";" && depth === 0) {
        end = index + 1;
        break;
      }
    }
    result = `${result.slice(0, start)} ${result.slice(end)}`;
    DECLARE_KEYWORD.lastIndex = start;
    match = DECLARE_KEYWORD.exec(result);
  }
  return result;
};

/**
 * True when a module re-exports other modules and contributes no runtime of
 * its own (type aliases and interfaces are erased at build time).
 *
 * Such a module is transparent: what it does at runtime is entirely decided by
 * the modules behind each exported binding, so the graph can follow only the
 * bindings a consumer actually imports.
 */
export const isPassThroughBarrel = (source: string): boolean => {
  const clean = stripComments(source);
  const residual = clean.replace(REEXPORT_STATEMENT, " ");
  if (residual === clean) {
    return false;
  }
  return !RUNTIME_TOKEN.test(stripAmbientDeclarations(residual));
};

/** Names a module publishes, including `export * from` chains. */
export const parseLocalExportNames = (source: string): string[] => {
  const clean = stripComments(source);
  const names = new Set<string>();
  const declaration =
    /\bexport\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|interface|type|enum|namespace)\s+([A-Za-z0-9_$]+)/g;
  for (const match of clean.matchAll(declaration)) {
    if (match[1]) {
      names.add(match[1]);
    }
  }
  if (/\bexport\s+default\b/.test(clean)) {
    names.add("default");
  }
  const namedExport = /\bexport\s+(?:type\s+)?\{([^}]*)\}(?!\s*from)/g;
  for (const match of clean.matchAll(namedExport)) {
    for (const part of (match[1] ?? "").split(",")) {
      const cleaned = part.trim().replace(/^type\s+/, "");
      if (!cleaned) {
        continue;
      }
      const pieces = cleaned.split(/\s+as\s+/).map((piece) => piece.trim());
      const exported = pieces[1] ?? pieces[0];
      if (exported) {
        names.add(exported);
      }
    }
  }
  return [...names];
};

export const readWorkspacePackages = ({repoRoot}: {repoRoot: string}): WorkspacePackage[] => {
  const rootManifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    workspaces?: string[];
  };
  const packages: WorkspacePackage[] = [];
  for (const entry of rootManifest.workspaces ?? []) {
    // The workspace list in this repo is a flat set of directory names.
    const dir = join(repoRoot, entry);
    const manifestPath = join(dir, "package.json");
    if (!existsSync(manifestPath)) {
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {name?: string};
    if (manifest.name) {
      packages.push({dir, name: manifest.name});
    }
  }
  return packages;
};

const tryFile = (candidate: string): string | undefined => {
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }
  for (const extension of SOURCE_EXTENSIONS) {
    const withExtension = `${candidate}${extension}`;
    if (existsSync(withExtension)) {
      return withExtension;
    }
  }
  for (const extension of SOURCE_EXTENSIONS) {
    const indexFile = join(candidate, `index${extension}`);
    if (existsSync(indexFile)) {
      return indexFile;
    }
  }
  return undefined;
};

const findPackageRoot = ({
  file,
  repoRoot,
}: {
  file: string;
  repoRoot: string;
}): string | undefined => {
  let current = dirname(file);
  while (current.startsWith(repoRoot) && current !== repoRoot) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }
  return undefined;
};

const externalPackageName = (specifier: string): string => {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : (segments[0] ?? specifier);
};

const resolveWorkspaceSubpath = ({
  packageDir,
  subpath,
}: {
  packageDir: string;
  subpath: string;
}): string | undefined => {
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
    exports?: Record<string, string | Record<string, string>>;
    main?: string;
  };
  const key = subpath ? `./${subpath}` : ".";
  const entry = manifest.exports?.[key];
  const target =
    typeof entry === "string" ? entry : (entry?.types ?? entry?.default ?? manifest.main);
  if (target) {
    const sourceTarget = target
      .replace(/^\.\//, "")
      .replace(/^dist\//, "src/")
      .replace(/\.d\.ts$/, "")
      .replace(/\.js$/, "");
    const resolved = tryFile(join(packageDir, sourceTarget));
    if (resolved) {
      return resolved;
    }
  }
  return tryFile(join(packageDir, "src", subpath || "index"));
};

export const resolveSpecifier = ({
  fromFile,
  repoRoot,
  specifier,
  workspacePackages,
}: {
  fromFile: string;
  repoRoot: string;
  specifier: string;
  workspacePackages: WorkspacePackage[];
}): ResolvedSpecifier => {
  if (specifier.startsWith(".")) {
    const resolved = tryFile(resolve(dirname(fromFile), specifier));
    return resolved ? {file: resolved, kind: "file"} : {kind: "unresolved"};
  }

  const workspaceMatch = workspacePackages.find(
    (workspacePackage) =>
      specifier === workspacePackage.name || specifier.startsWith(`${workspacePackage.name}/`)
  );
  if (workspaceMatch) {
    const subpath = specifier.slice(workspaceMatch.name.length).replace(/^\//, "");
    const resolved = resolveWorkspaceSubpath({packageDir: workspaceMatch.dir, subpath});
    return resolved ? {file: resolved, kind: "file"} : {kind: "unresolved"};
  }

  const alias = ROOT_ALIASES.find((candidate) => specifier.startsWith(candidate));
  if (alias) {
    const packageRoot = findPackageRoot({file: fromFile, repoRoot});
    if (!packageRoot) {
      return {kind: "unresolved"};
    }
    const rest =
      alias === "@/"
        ? specifier.slice(2)
        : `${alias.slice(1, -1)}/${specifier.slice(alias.length)}`;
    const resolved = tryFile(join(packageRoot, rest));
    return resolved ? {file: resolved, kind: "file"} : {kind: "unresolved"};
  }

  if (specifier.startsWith("@") || /^[a-z0-9]/i.test(specifier)) {
    return {externalPackage: externalPackageName(specifier), kind: "external"};
  }
  return {kind: "unresolved"};
};

interface QueueEntry {
  file: string;
  names: string[] | null;
}

/**
 * Walk the import graph from `roots`, pruning barrel re-exports down to the
 * binding names consumers actually import.
 */
export const collectReachable = ({
  repoRoot,
  roots,
  workspacePackages = readWorkspacePackages({repoRoot}),
}: {
  repoRoot: string;
  roots: string[];
  workspacePackages?: WorkspacePackage[];
}): ReachableGraph => {
  const sources = new Map<string, string>();
  const barrelFlags = new Map<string, boolean>();
  const exportNames = new Map<string, Set<string>>();
  const lazyEdges = new Map<string, ImportEdge[]>();
  const followedLazyKeys = new Map<string, Set<string>>();
  const graph: ReachableGraph = {
    barrels: new Map(),
    externalPackages: new Set(),
    files: new Set(),
    requestedNames: new Map(),
    unresolved: false,
    unresolvedSpecifiers: [],
  };

  const markUnresolved = (fromFile: string, specifier: string): void => {
    graph.unresolved = true;
    graph.unresolvedSpecifiers.push(
      `${toRepoRelative({file: fromFile, repoRoot})} -> ${specifier}`
    );
  };

  const readSource = (file: string): string => {
    const cached = sources.get(file);
    if (cached !== undefined) {
      return cached;
    }
    const source = readFileSync(file, "utf8");
    sources.set(file, source);
    return source;
  };

  const isBarrel = (file: string): boolean => {
    const cached = barrelFlags.get(file);
    if (cached !== undefined) {
      return cached;
    }
    const value = isPassThroughBarrel(readSource(file));
    barrelFlags.set(file, value);
    return value;
  };

  const resolveFrom = (fromFile: string, specifier: string): ResolvedSpecifier =>
    resolveSpecifier({fromFile, repoRoot, specifier, workspacePackages});

  /** Every name a module publishes, following `export * from` chains. */
  const collectExportNames = (file: string, seen: Set<string> = new Set()): Set<string> => {
    const cached = exportNames.get(file);
    if (cached) {
      return cached;
    }
    if (seen.has(file)) {
      return new Set();
    }
    seen.add(file);
    const source = readSource(file);
    const names = new Set(parseLocalExportNames(source));
    for (const statement of parseReexports(source)) {
      const resolved = resolveFrom(file, statement.specifier);
      if (statement.entries) {
        for (const entry of statement.entries) {
          names.add(entry.exported);
        }
        continue;
      }
      if (resolved.kind !== "file") {
        continue;
      }
      for (const name of collectExportNames(resolved.file, seen)) {
        names.add(name);
      }
    }
    exportNames.set(file, names);
    return names;
  };

  const queue: QueueEntry[] = roots.map((file) => ({file, names: null}));

  const enqueue = (entry: QueueEntry): void => {
    queue.push(entry);
  };

  const visitBarrel = (file: string, names: string[]): void => {
    const previous = graph.barrels.get(file);
    if (previous === "all") {
      return;
    }
    const requested = previous ?? new Set<string>();
    graph.barrels.set(file, requested);
    const statements = parseReexports(readSource(file));
    const pending = names.filter((name) => !requested.has(name));
    for (const name of pending) {
      requested.add(name);
    }
    /**
     * Runtime re-exports decide where a binding comes from; `export type *`
     * statements only republish types, so they are checked second and never
     * pull a module in.
     */
    const provides = ({
      follow,
      name,
      statement,
    }: {
      follow: boolean;
      name: string;
      statement: ReexportStatement;
    }): boolean => {
      const resolved = resolveFrom(file, statement.specifier);
      if (statement.entries) {
        const entry = statement.entries.find((candidate) => candidate.exported === name);
        if (!entry) {
          return false;
        }
        if (!follow) {
          return true;
        }
        if (resolved.kind === "file") {
          enqueue({file: resolved.file, names: entry.local === "*" ? null : [entry.local]});
        } else if (resolved.kind === "external") {
          graph.externalPackages.add(resolved.externalPackage);
        } else {
          markUnresolved(file, statement.specifier);
        }
        return true;
      }
      if (resolved.kind === "external") {
        graph.externalPackages.add(resolved.externalPackage);
        return false;
      }
      if (resolved.kind !== "file") {
        markUnresolved(file, statement.specifier);
        return false;
      }
      if (!collectExportNames(resolved.file).has(name)) {
        return false;
      }
      if (follow) {
        enqueue({file: resolved.file, names: [name]});
      }
      return true;
    };

    for (const name of pending) {
      let matched = statements
        .filter((statement) => !statement.typeOnly)
        .some((statement) => provides({follow: true, name, statement}));
      if (!matched) {
        matched = statements
          .filter((statement) => statement.typeOnly)
          .some((statement) => provides({follow: false, name, statement}));
      }
      if (!matched && parseLocalExportNames(readSource(file)).includes(name)) {
        // A pass-through barrel can only declare type-level names itself, and
        // those are erased at build time.
        matched = true;
      }
      if (!matched) {
        // The barrel publishes a name we cannot trace; pull everything it
        // re-exports rather than pruning a module that may be in play.
        graph.barrels.set(file, "all");
        for (const statement of statements) {
          const resolved = resolveFrom(file, statement.specifier);
          if (resolved.kind === "file") {
            enqueue({file: resolved.file, names: null});
          } else if (resolved.kind === "external") {
            graph.externalPackages.add(resolved.externalPackage);
          }
        }
        return;
      }
    }
  };

  while (queue.length > 0) {
    const entry = queue.pop();
    if (!entry) {
      break;
    }
    const {file} = entry;
    if (!existsSync(file)) {
      markUnresolved(file, file);
      continue;
    }
    if (isBarrel(file) && entry.names !== null) {
      visitBarrel(file, entry.names);
      continue;
    }
    if (isBarrel(file)) {
      graph.barrels.set(file, "all");
      for (const statement of parseReexports(readSource(file))) {
        const resolved = resolveFrom(file, statement.specifier);
        if (resolved.kind === "file") {
          enqueue({file: resolved.file, names: null});
        } else if (resolved.kind === "external") {
          graph.externalPackages.add(resolved.externalPackage);
        }
      }
      continue;
    }
    const followEdge = (edge: ImportEdge): void => {
      if (edge.typeOnly) {
        return;
      }
      const resolved = resolveFrom(file, edge.specifier);
      if (resolved.kind === "file") {
        enqueue({file: resolved.file, names: edge.names});
        return;
      }
      if (resolved.kind === "external") {
        graph.externalPackages.add(resolved.externalPackage);
        return;
      }
      // Asset and JSON imports are not part of the module graph we model.
      if (!/\.(json|png|jpe?g|svg|ttf|otf|woff2?|css|html|md)$/i.test(edge.specifier)) {
        markUnresolved(file, edge.specifier);
      }
    };

    const previouslyRequested = graph.requestedNames.get(file);
    if (entry.names === null || previouslyRequested === "all") {
      graph.requestedNames.set(file, "all");
    } else {
      const requested = previouslyRequested ?? new Set<string>();
      for (const name of entry.names) {
        requested.add(name);
      }
      graph.requestedNames.set(file, requested);
    }

    if (!graph.files.has(file)) {
      graph.files.add(file);
      const source = readSource(file);
      const localExports = new Set(parseLocalExportNames(source));
      const edges = parseImportEdges(source);
      const keyed = edges.filter((edge) => edge.key !== undefined && localExports.has(edge.key));
      lazyEdges.set(file, keyed);
      for (const edge of edges) {
        if (!keyed.includes(edge)) {
          followEdge(edge);
        }
      }
    }

    const keyedEdges = lazyEdges.get(file) ?? [];
    if (keyedEdges.length > 0) {
      const followed = followedLazyKeys.get(file) ?? new Set<string>();
      followedLazyKeys.set(file, followed);
      const keys = keyedEdges.map((edge) => edge.key ?? "");
      // A consumer that imports anything other than the lazy bindings may hold
      // the factory map itself, so fall back to loading every lazy module.
      const wantsEverything =
        entry.names === null || entry.names.some((name) => !keys.includes(name));
      for (const edge of keyedEdges) {
        const key = edge.key ?? "";
        if (followed.has(key) || !(wantsEverything || entry.names?.includes(key))) {
          continue;
        }
        followed.add(key);
        followEdge(edge);
      }
    }
  }

  return graph;
};

const toRepoRelative = ({file, repoRoot}: {file: string; repoRoot: string}): string =>
  isAbsolute(file) ? relative(repoRoot, file) : file;
