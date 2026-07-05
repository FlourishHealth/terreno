import {Platform} from "react-native";

import {googleFontsUrl} from "./fonts";

/**
 * Web-only font loader for the palette generator. Kept separate from `fonts.ts` so that module can
 * stay free of the react-native import and remain unit-testable.
 */

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
