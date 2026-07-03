import {Platform} from "react-native";

/**
 * Font selection support for the palette generator: curated Google Font choices for headings and
 * body, ready-made pairings, and a web-only loader that injects the chosen families so previews
 * render in the real typeface. On native the family name is still applied (and falls back to the
 * system font if the family is not bundled), since the demo's primary target is web.
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

const WEB_FONT_LINK_ID = "palette-generator-fonts";

/**
 * Inject (or update) a `<link>` in the document head so the chosen families are actually available
 * to the preview on web. No-op on native and during SSR.
 */
export const loadWebFonts = (families: string[]): void => {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return;
  }
  const href = googleFontsUrl(families);
  const existing = document.getElementById(WEB_FONT_LINK_ID) as HTMLLinkElement | null;
  if (existing) {
    if (existing.href !== href) {
      existing.href = href;
    }
    return;
  }
  const link = document.createElement("link");
  link.id = WEB_FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

/** Merge a base option list with an extra value (e.g. an LLM suggestion) so it stays selectable. */
export const buildFontOptions = (
  base: string[],
  extra?: string
): {label: string; value: string}[] => {
  const values = extra && !base.includes(extra) ? [extra, ...base] : base;
  return values.map((value) => ({label: value, value}));
};
