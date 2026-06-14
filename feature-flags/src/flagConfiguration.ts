import {evaluateFlag} from "./evaluate";
import type {FeatureFlagDocument, FlagDefinition, SegmentFunction} from "./types";

/**
 * Resolves the OpenFeature defaultVariant for a flag document, including legacy
 * documents that omit the field.
 */
export const effectiveDefaultVariantForFlag = (flag: FeatureFlagDocument): string => {
  if (flag.defaultVariant) {
    return flag.defaultVariant;
  }
  if (flag.type === "boolean") {
    return "off";
  }
  return flag.variants[0]?.key ?? "off";
};

/**
 * Builds a {@link FlagDefinition} for the `/flagConfiguration` wire shape from a
 * persisted flag and the resolved evaluation for one user.
 */
export const buildFlagDefinition = (
  flag: FeatureFlagDocument,
  targetingKey: string,
  user: unknown,
  segments: Record<string, SegmentFunction>
): FlagDefinition => {
  const evaluated = evaluateFlag(flag, targetingKey, user, segments);

  if (flag.type === "boolean") {
    const active = evaluated === true;
    return {
      defaultVariant: active ? "on" : "off",
      disabled: false,
      variants: {off: false, on: true},
    };
  }

  const variantKeys = flag.variants.map((v) => v.key);
  let resolved: string;
  if (typeof evaluated === "string" && variantKeys.includes(evaluated)) {
    resolved = evaluated;
  } else {
    resolved = effectiveDefaultVariantForFlag(flag);
  }

  const variants: Record<string, string> = {};
  for (const k of variantKeys) {
    variants[k] = k;
  }

  return {
    defaultVariant: resolved,
    disabled: false,
    variants,
  };
};
