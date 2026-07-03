import {describe, expect, it} from "bun:test";

import {
  assessContrast,
  contrastRatio,
  generateColorScale,
  generatePrimitivesFromAnchors,
  generateStatusScale,
  hexToHsl,
  hexToRgb,
  hslToHex,
  normalizeHex,
  type PaletteAnchors,
  readableTextColor,
  relativeLuminance,
  rgbToHex,
  SHADE_KEYS,
  STATUS_SHADE_KEYS,
} from "./colorUtils";

describe("normalizeHex", () => {
  it("expands 3-digit shorthand", () => {
    expect(normalizeHex("#abc")).toBe("#aabbcc");
    expect(normalizeHex("f00")).toBe("#ff0000");
  });

  it("normalizes 6-digit values and casing", () => {
    expect(normalizeHex("#AABBCC")).toBe("#aabbcc");
    expect(normalizeHex("0086B3")).toBe("#0086b3");
  });

  it("returns undefined for invalid input", () => {
    expect(normalizeHex("")).toBeUndefined();
    expect(normalizeHex("nope")).toBeUndefined();
    expect(normalizeHex("#12345")).toBeUndefined();
  });
});

describe("rgb/hsl conversions", () => {
  it("round-trips hex through rgb", () => {
    expect(rgbToHex(hexToRgb("#0086b3")!)).toBe("#0086b3");
  });

  it("round-trips hex through hsl within tolerance", () => {
    const original = "#0086b3";
    const roundTripped = hslToHex(hexToHsl(original)!);
    const a = hexToRgb(original)!;
    const b = hexToRgb(roundTripped)!;
    expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(2);
  });

  it("treats grays as zero saturation", () => {
    expect(hexToHsl("#808080")!.s).toBe(0);
  });
});

describe("generateColorScale", () => {
  it("produces all 11 shades", () => {
    const scale = generateColorScale("#0086b3");
    expect(Object.keys(scale).sort()).toEqual([...SHADE_KEYS].sort());
  });

  it("places the anchor verbatim at 500", () => {
    expect(generateColorScale("#0086b3")["500"]).toBe("#0086b3");
  });

  it("ramps from light to dark monotonically", () => {
    const scale = generateColorScale("#0086b3");
    const luminances = SHADE_KEYS.map((shade) => relativeLuminance(scale[shade]));
    for (let i = 1; i < luminances.length; i += 1) {
      expect(luminances[i]).toBeLessThanOrEqual(luminances[i - 1] + 0.0001);
    }
  });

  it("throws on invalid anchor", () => {
    expect(() => generateColorScale("bogus")).toThrow();
  });
});

describe("generateStatusScale", () => {
  it("produces the compact 3-step ramp", () => {
    const scale = generateStatusScale("#d33232");
    expect(Object.keys(scale).sort()).toEqual([...STATUS_SHADE_KEYS].sort());
  });
});

describe("generatePrimitivesFromAnchors", () => {
  const anchors: PaletteAnchors = {
    accent: "#d69c0e",
    error: "#d33232",
    neutral: "#9a9a9a",
    primary: "#0086b3",
    secondary: "#2b6072",
    success: "#3ea45c",
    warning: "#f36719",
  };

  it("emits every expected primitive key", () => {
    const primitives = generatePrimitivesFromAnchors(anchors);
    expect(primitives.primary500).toBe("#0086b3");
    expect(primitives.neutral000).toBeDefined();
    expect(primitives.accent900).toBeDefined();
    expect(primitives.error100).toBeDefined();
    expect(primitives.warning200).toBeDefined();
    expect(primitives.success000).toBeDefined();
    // 4 families * 11 shades + 3 status families * 3 shades = 53 keys
    expect(Object.keys(primitives).length).toBe(53);
  });
});

describe("WCAG contrast", () => {
  it("computes the canonical black/white ratio as 21", () => {
    expect(Math.round(contrastRatio("#000000", "#ffffff"))).toBe(21);
  });

  it("computes identical colors as 1", () => {
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });

  it("flags a failing low-contrast pair", () => {
    const assessment = assessContrast("#cccccc", "#ffffff");
    expect(assessment.aa).toBe(false);
    expect(assessment.aaLarge).toBe(false);
  });

  it("passes AA and AAA for strong contrast", () => {
    const assessment = assessContrast("#1c1c1c", "#ffffff");
    expect(assessment.aa).toBe(true);
    expect(assessment.aaa).toBe(true);
  });

  it("picks a readable text color for a background", () => {
    expect(readableTextColor("#ffffff")).toBe("#000000");
    expect(readableTextColor("#013749")).toBe("#ffffff");
  });
});
