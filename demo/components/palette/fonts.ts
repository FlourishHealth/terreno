/**
 * Font selection support for the palette generator: curated Google Font choices for headings and
 * body, ready-made pairings, and helpers. This module is intentionally dependency-free (no
 * react-native import) so it can be unit tested; the web font loader lives in `webFonts.ts`.
 */

export interface FontSelection {
  /** Family used for headings/display (e.g. "Titillium Web"). */
  headingFont: string;
  /** Family used for body copy and UI text (e.g. "Nunito"). */
  bodyFont: string;
}

/** Matches the stock Terreno theme fonts so the tool opens on a known-good pairing. */
export const DEFAULT_FONTS: FontSelection = {
  bodyFont: "Nunito",
  headingFont: "Titillium Web",
};

/** Curated display/heading families. */
export const HEADING_FONTS: string[] = [
  "Titillium Web",
  "Poppins",
  "Montserrat",
  "Space Grotesk",
  "Archivo",
  "Libre Franklin",
  "Sora",
  "Playfair Display",
  "Fraunces",
  "DM Serif Display",
  "Bricolage Grotesque",
];

/** Curated body/UI families. */
export const BODY_FONTS: string[] = [
  "Nunito",
  "Inter",
  "Roboto",
  "Open Sans",
  "Source Sans 3",
  "Work Sans",
  "Lato",
  "IBM Plex Sans",
  "Mulish",
  "DM Sans",
  "Rubik",
];

/** Hand-picked heading/body pairings the assistant can also suggest. */
export const FONT_PAIRINGS: {name: string; fonts: FontSelection}[] = [
  {fonts: DEFAULT_FONTS, name: "Terreno default"},
  {fonts: {bodyFont: "Inter", headingFont: "Space Grotesk"}, name: "Modern SaaS"},
  {fonts: {bodyFont: "Source Sans 3", headingFont: "Playfair Display"}, name: "Editorial"},
  {fonts: {bodyFont: "Nunito", headingFont: "Poppins"}, name: "Friendly"},
  {fonts: {bodyFont: "Roboto", headingFont: "Montserrat"}, name: "Corporate"},
  {fonts: {bodyFont: "Mulish", headingFont: "Fraunces"}, name: "Warm serif"},
];

/** Build a Google Fonts CSS2 URL that loads all requested families with common weights. */
export const googleFontsUrl = (families: string[]): string => {
  const unique = Array.from(new Set(families.filter(Boolean)));
  const params = unique
    .map((family) => `family=${encodeURIComponent(family)}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

/** Merge a base option list with an extra value (e.g. an LLM suggestion) so it stays selectable. */
export const buildFontOptions = (
  base: string[],
  extra?: string
): {label: string; value: string}[] => {
  const values = extra && !base.includes(extra) ? [extra, ...base] : base;
  return values.map((value) => ({label: value, value}));
};
