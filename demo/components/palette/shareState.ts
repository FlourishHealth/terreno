import {normalizeHex, type PaletteAnchors} from "./colorUtils";
import type {FontSelection} from "./fonts";
import {ANCHOR_FAMILIES} from "./paletteTypes";

/**
 * Encodes/decodes the shareable part of the palette generator state (anchor colors + fonts) into a
 * compact URL token so a palette can be shared via a link. The API key and chat history are
 * intentionally excluded — the key is a secret and the palette is fully reconstructable from the
 * anchors and fonts.
 */

/** Query-string parameter that carries the encoded state. */
export const SHARE_PARAM = "s";

export interface ShareState {
  anchors: PaletteAnchors;
  fonts: FontSelection;
}

const toBase64Url = (input: string): string => {
  const base64 = typeof globalThis.btoa === "function" ? globalThis.btoa(input) : input;
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64Url = (token: string): string | undefined => {
  const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return typeof globalThis.atob === "function" ? globalThis.atob(base64) : base64;
  } catch {
    return undefined;
  }
};

/** Encode anchors + fonts into a compact, URL-safe token. */
export const encodeShareState = (state: ShareState): string => {
  const payload = JSON.stringify({a: state.anchors, f: state.fonts});
  return toBase64Url(payload);
};

/**
 * Decode a share token back into a `ShareState`. Returns `undefined` if the token is missing,
 * malformed, or does not contain a full, valid set of anchors and fonts, so a bad link never
 * corrupts the palette.
 */
export const decodeShareState = (token: string | undefined): ShareState | undefined => {
  if (!token) {
    return undefined;
  }
  const json = fromBase64Url(token);
  if (!json) {
    return undefined;
  }
  let parsed: {a?: Record<string, string>; f?: {headingFont?: string; bodyFont?: string}};
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  const rawAnchors = parsed.a;
  const rawFonts = parsed.f;
  if (!rawAnchors || !rawFonts) {
    return undefined;
  }

  const anchors = {} as PaletteAnchors;
  for (const family of ANCHOR_FAMILIES) {
    const hex = normalizeHex(rawAnchors[family] ?? "");
    if (!hex) {
      return undefined;
    }
    anchors[family] = hex;
  }

  if (typeof rawFonts.headingFont !== "string" || typeof rawFonts.bodyFont !== "string") {
    return undefined;
  }

  return {
    anchors,
    fonts: {bodyFont: rawFonts.bodyFont, headingFont: rawFonts.headingFont},
  };
};

/**
 * Build a full share URL for the current state, based on the current web location. Returns
 * `undefined` when there is no location (native / SSR).
 */
export const buildShareUrl = (state: ShareState): string | undefined => {
  const location = (globalThis as {location?: {href?: string}}).location;
  if (!location?.href) {
    return undefined;
  }
  try {
    const url = new URL(location.href);
    url.searchParams.set(SHARE_PARAM, encodeShareState(state));
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
};
