import {describe, expect, it} from "bun:test";

import {buildFlagDefinition, effectiveDefaultVariantForFlag} from "./flagConfiguration";
import type {FeatureFlagDocument, SegmentFunction} from "./types";

const booleanFlag = (overrides: Partial<FeatureFlagDocument> = {}): FeatureFlagDocument =>
  ({
    archived: false,
    description: "d",
    enabled: true,
    key: "bool",
    name: "Bool",
    rolloutPercentage: 100,
    rules: [],
    type: "boolean",
    variants: [],
    ...overrides,
  }) as unknown as FeatureFlagDocument;

const variantFlag = (overrides: Partial<FeatureFlagDocument> = {}): FeatureFlagDocument =>
  ({
    archived: false,
    description: "d",
    enabled: true,
    key: "exp",
    name: "Exp",
    rolloutPercentage: 100,
    rules: [],
    type: "variant",
    variants: [
      {key: "control", weight: 50},
      {key: "treatment", weight: 50},
    ],
    ...overrides,
  }) as unknown as FeatureFlagDocument;

const noSegments: Record<string, SegmentFunction> = {};

describe("effectiveDefaultVariantForFlag", () => {
  it("uses defaultVariant when present", () => {
    expect(effectiveDefaultVariantForFlag(booleanFlag({defaultVariant: "on"}))).toBe("on");
  });

  it("defaults boolean flags to off", () => {
    expect(effectiveDefaultVariantForFlag(booleanFlag())).toBe("off");
  });

  it("defaults variant flags to the first variant key", () => {
    expect(effectiveDefaultVariantForFlag(variantFlag())).toBe("control");
    expect(effectiveDefaultVariantForFlag(variantFlag({variants: []}))).toBe("off");
  });
});

describe("buildFlagDefinition", () => {
  it("maps a boolean evaluation to on/off variants", () => {
    expect(buildFlagDefinition(booleanFlag(), "user-1", {}, noSegments)).toEqual({
      defaultVariant: "on",
      disabled: false,
      variants: {off: false, on: true},
    });
  });

  it("maps a disabled variant flag onto the default variant", () => {
    const definition = buildFlagDefinition(variantFlag({enabled: false}), "user-1", {}, noSegments);
    expect(definition.defaultVariant).toBe("control");
    expect(definition.variants).toEqual({control: "control", treatment: "treatment"});
  });

  it("uses the evaluated variant key when it matches a defined variant", () => {
    const definition = buildFlagDefinition(
      variantFlag({
        rules: [{variant: "treatment", field: "id", operator: "eq", value: "user-1"}],
      }),
      "user-1",
      {id: "user-1"},
      noSegments
    );
    expect(definition.defaultVariant).toBe("treatment");
  });
});
