import {MAIN_FAMILIES, SHADE_KEYS, STATUS_FAMILIES, STATUS_SHADE_KEYS} from "./colorUtils";

/**
 * Turn a flat map of generated color primitives into copy-pasteable code for a Terreno app: either
 * a `ThemePrimitives` object literal or a live `setPrimitives(...)` call. Keys are emitted family by
 * family, lightest to darkest, so the output matches the order in `ui/src/Theme.tsx`.
 */

const orderedColorKeys = (): string[] => {
  const keys: string[] = [];
  for (const family of MAIN_FAMILIES) {
    for (const shade of SHADE_KEYS) {
      keys.push(`${family}${shade}`);
    }
  }
  for (const family of STATUS_FAMILIES) {
    for (const shade of STATUS_SHADE_KEYS) {
      keys.push(`${family}${shade}`);
    }
  }
  return keys;
};

const formatEntries = (primitives: Record<string, string>, indent: string): string => {
  return orderedColorKeys()
    .filter((key) => primitives[key])
    .map((key) => `${indent}${key}: "${primitives[key]}",`)
    .join("\n");
};

/** A `const paletteColors = {...}` object literal for pasting into a theme file. */
export const buildPrimitivesObjectCode = (primitives: Record<string, string>): string => {
  return `// Generated color primitives — merge these into your Terreno theme.\nexport const paletteColors = {\n${formatEntries(primitives, "  ")}\n};`;
};

/** A `setPrimitives({...})` call for applying the palette at runtime via `useTheme()`. */
export const buildSetPrimitivesCode = (primitives: Record<string, string>): string => {
  return `// Apply at runtime with the useTheme() hook from @terreno/ui.\nconst {setPrimitives} = useTheme();\nsetPrimitives({\n${formatEntries(primitives, "  ")}\n});`;
};
