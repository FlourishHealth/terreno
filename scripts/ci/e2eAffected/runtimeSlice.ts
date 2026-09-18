/**
 * Per-binding comparison of two revisions of a module.
 *
 * Registry modules (`@terreno/ui`'s lazy boundaries, for example) grow one
 * entry per new component. Those entries only execute for consumers that
 * import that binding, so a module whose remaining runtime is byte-identical
 * after removing unimported bindings cannot change what e2e exercises.
 */
import {runtimeSkeleton, stripComments} from "./moduleGraph";

const OPENERS: Record<string, string> = {"(": ")", "[": "]", "{": "}"};

const EXPORT_DECLARATION =
  /\bexport\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z0-9_$]+)/g;

const KEYED_LAZY_ENTRY =
  /([A-Za-z0-9_$]+)\s*:\s*\(\s*\)\s*=>\s*import\s*\(\s*["'][^"']+["']\s*\)\s*,?/g;

export interface TopLevelDeclaration {
  end: number;
  isBlock: boolean;
  name: string;
  start: number;
}

/** Depth-0 `export const|let|var|function|class NAME` declarations. */
export const findTopLevelExportDeclarations = (source: string): TopLevelDeclaration[] => {
  const declarations: TopLevelDeclaration[] = [];
  EXPORT_DECLARATION.lastIndex = 0;
  for (const match of source.matchAll(EXPORT_DECLARATION)) {
    const start = match.index ?? 0;
    if (depthAt({index: start, source}) !== 0) {
      continue;
    }
    const isBlock = /\b(?:function|class)\b/.test(match[0]);
    const end = declarationEnd({isBlock, source, start: start + match[0].length});
    if (end === -1) {
      continue;
    }
    declarations.push({end, isBlock, name: match[1] ?? "", start});
  }
  return declarations;
};

const depthAt = ({index, source}: {index: number; source: string}): number => {
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const character = source[cursor] ?? "";
    if (OPENERS[character]) {
      depth += 1;
    } else if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
    }
  }
  return depth;
};

const declarationEnd = ({
  isBlock,
  source,
  start,
}: {
  isBlock: boolean;
  source: string;
  start: number;
}): number => {
  let depth = 0;
  let sawBlock = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (OPENERS[character]) {
      depth += 1;
      if (character === "{") {
        sawBlock = true;
      }
      continue;
    }
    if (character === ")" || character === "]" || character === "}") {
      depth -= 1;
      if (isBlock && sawBlock && depth === 0 && character === "}") {
        return index + 1;
      }
      continue;
    }
    if (!isBlock && depth === 0 && character === ";") {
      return index + 1;
    }
  }
  return -1;
};

/**
 * Drops lazy factory entries and exported declarations whose binding no
 * consumer imports. A declaration is kept when the rest of the module still
 * references it, so helpers behind a used export are never sliced away.
 */
export const sliceUnusedBindings = ({
  keep,
  source,
}: {
  keep: Set<string>;
  source: string;
}): string => {
  const clean = stripComments(source);
  const withoutLazyEntries = clean.replace(KEYED_LAZY_ENTRY, (match, key: string) =>
    keep.has(key) ? match : " "
  );
  let result = withoutLazyEntries;
  for (const declaration of findTopLevelExportDeclarations(withoutLazyEntries).reverse()) {
    if (keep.has(declaration.name) || declaration.name.length === 0) {
      continue;
    }
    const remainder = `${result.slice(0, declaration.start)} ${result.slice(declaration.end)}`;
    if (new RegExp(`\\b${declaration.name}\\b`).test(runtimeSkeleton(remainder))) {
      continue;
    }
    result = remainder;
  }
  return result;
};

/**
 * True when two revisions of a module have identical runtime once bindings
 * nothing imports are removed.
 */
export const hasSameRequestedRuntime = ({
  baseSource,
  headSource,
  requestedNames,
}: {
  baseSource: string;
  headSource: string;
  requestedNames: Set<string>;
}): boolean =>
  runtimeSkeleton(sliceUnusedBindings({keep: requestedNames, source: baseSource})) ===
  runtimeSkeleton(sliceUnusedBindings({keep: requestedNames, source: headSource}));
