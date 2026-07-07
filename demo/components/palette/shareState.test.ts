import {describe, expect, it} from "bun:test";

import {DEFAULT_FONTS} from "./fonts";
import {DEFAULT_ANCHORS} from "./paletteTypes";
import {decodeShareState, encodeShareState, type ShareState} from "./shareState";

/**
 * Tests for the shareable-link encoding. Round-trips state and verifies that malformed or partial
 * tokens are rejected rather than corrupting the palette.
 */

const state: ShareState = {anchors: DEFAULT_ANCHORS, fonts: DEFAULT_FONTS};

describe("share state encode/decode", () => {
  it("round-trips anchors and fonts", () => {
    const decoded = decodeShareState(encodeShareState(state));
    expect(decoded).toEqual(state);
  });

  it("produces a URL-safe token (no +, /, or =)", () => {
    const token = encodeShareState(state);
    expect(token).not.toMatch(/[+/=]/);
  });

  it("normalizes hex values on decode", () => {
    const token = encodeShareState({
      anchors: {...DEFAULT_ANCHORS, primary: "#ABC"},
      fonts: DEFAULT_FONTS,
    });
    expect(decodeShareState(token)?.anchors.primary).toBe("#aabbcc");
  });

  it("returns undefined for empty or garbage tokens", () => {
    expect(decodeShareState(undefined)).toBeUndefined();
    expect(decodeShareState("")).toBeUndefined();
    expect(decodeShareState("!!!not-base64!!!")).toBeUndefined();
  });

  it("returns undefined when a family is missing", () => {
    const {primary, ...partial} = DEFAULT_ANCHORS;
    const token = encodeShareState({
      anchors: partial as typeof DEFAULT_ANCHORS,
      fonts: DEFAULT_FONTS,
    });
    expect(decodeShareState(token)).toBeUndefined();
  });

  it("returns undefined when fonts are missing", () => {
    const token = globalThis
      .btoa(JSON.stringify({a: DEFAULT_ANCHORS}))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(decodeShareState(token)).toBeUndefined();
  });
});
