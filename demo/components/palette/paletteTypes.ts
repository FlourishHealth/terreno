import type {PaletteAnchors} from "./colorUtils";
import {
  assessContrast,
  MAIN_FAMILIES,
  type MainFamily,
  STATUS_FAMILIES,
  type StatusFamily,
} from "./colorUtils";

/**
 * Shared types and constants for the palette generator: chat messages, the anchor set the LLM and
 * the color pickers both drive, and the curated WCAG contrast checks that run against the generated
 * theme primitives.
 */

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** ISO timestamp (Luxon) for ordering/display. */
  createdAt: string;
}

/** Human-friendly labels for each anchor family, shown next to the color pickers. */
export const FAMILY_LABELS: Record<MainFamily | StatusFamily, string> = {
  accent: "Accent",
  error: "Error",
  neutral: "Neutral",
  primary: "Primary",
  secondary: "Secondary",
  success: "Success",
  warning: "Warning",
};

/** Ordered list of every anchor family the UI exposes as a color input. */
export const ANCHOR_FAMILIES: (MainFamily | StatusFamily)[] = [
  ...MAIN_FAMILIES,
  ...STATUS_FAMILIES,
];

/** The default anchor set, matching the stock Terreno theme so the tool opens on a known-good palette. */
export const DEFAULT_ANCHORS: PaletteAnchors = {
  accent: "#d69c0e",
  error: "#d33232",
  neutral: "#9a9a9a",
  primary: "#0086b3",
  secondary: "#2b6072",
  success: "#3ea45c",
  warning: "#f36719",
};

/**
 * A single foreground/background contrast pairing to evaluate. `foreground` and `background` are
 * theme primitive keys (e.g. `neutral900`), matching the role→primitive mapping in the stock theme.
 */
export interface ContrastCheckDef {
  label: string;
  foreground: string;
  background: string;
  /**
   * Large text and UI component boundaries only need 3:1 (AA). Normal body text needs 4.5:1.
   */
  largeText?: boolean;
}

/**
 * Curated set of the most important text/surface pairings in the stock Terreno theme. These mirror
 * `defaultTheme` in `ui/src/Theme.tsx`, so flagging one here flags a real accessibility risk in an
 * app using the generated palette.
 */
export const CONTRAST_CHECKS: ContrastCheckDef[] = [
  {background: "neutral000", foreground: "neutral900", label: "Body text on page"},
  {background: "neutral000", foreground: "neutral600", label: "Secondary text on page"},
  {background: "neutral000", foreground: "primary600", label: "Link text on page"},
  {background: "neutral000", foreground: "accent700", label: "Accent text on page"},
  {background: "primary400", foreground: "neutral000", label: "Inverted text on primary surface"},
  {
    background: "secondary500",
    foreground: "neutral000",
    label: "Inverted text on secondary surface",
  },
  {background: "error200", foreground: "neutral000", label: "Inverted text on error surface"},
  {background: "success200", foreground: "neutral000", label: "Inverted text on success surface"},
  {background: "warning100", foreground: "neutral000", label: "Inverted text on warning surface"},
  {background: "neutral000", foreground: "error200", label: "Error text on page"},
  {
    background: "neutral000",
    foreground: "neutral300",
    label: "Default border on page (UI)",
    largeText: true,
  },
];

export interface ContrastResult extends ContrastCheckDef {
  ratio: number;
  foregroundHex: string;
  backgroundHex: string;
  /** True when the pairing meets its required WCAG AA threshold (4.5:1, or 3:1 for large/UI). */
  passes: boolean;
  /** True when the pairing also meets AAA (7:1, or 4.5:1 for large/UI). */
  passesAaa: boolean;
}

/** Run every curated contrast check against a flat map of generated primitives. */
export const runContrastChecks = (primitives: Record<string, string>): ContrastResult[] => {
  return CONTRAST_CHECKS.map((check) => {
    const foregroundHex = primitives[check.foreground] ?? "#000000";
    const backgroundHex = primitives[check.background] ?? "#ffffff";
    const assessment = assessContrast(foregroundHex, backgroundHex);
    const passes = check.largeText ? assessment.aaLarge : assessment.aa;
    const passesAaa = check.largeText ? assessment.aaaLarge : assessment.aaa;
    return {
      ...check,
      backgroundHex,
      foregroundHex,
      passes,
      passesAaa,
      ratio: assessment.ratio,
    };
  });
};

/** Convenience aggregate for the header badge ("3 issues"). */
export const countContrastFailures = (results: ContrastResult[]): number => {
  return results.filter((result) => !result.passes).length;
};

export type {MainFamily, StatusFamily};
export {MAIN_FAMILIES, STATUS_FAMILIES};
