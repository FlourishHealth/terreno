import {logger} from "@terreno/api";
import get from "lodash/get";
import type {
  EvaluationResult,
  FeatureFlagDocument,
  FeatureFlagRule,
  SegmentFunction,
} from "./types";

/**
 * Deterministic hash of a string to a number between 0 and 99.
 * Uses a simple but effective hash (djb2) to ensure the same user+flag
 * combination always produces the same result.
 */
export const deterministicHash = (input: string): number => {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash) % 100;
};

const matchesFieldRule = (user: unknown, rule: FeatureFlagRule): boolean => {
  if (!rule.field || !rule.operator) {
    return false;
  }

  const fieldValue = get(user, rule.field);
  const ruleValue = rule.value;

  switch (rule.operator) {
    case "eq":
      return fieldValue === ruleValue;
    case "neq":
      return fieldValue !== ruleValue;
    case "in":
      return Array.isArray(ruleValue) && ruleValue.includes(fieldValue);
    case "nin":
      return Array.isArray(ruleValue) && !ruleValue.includes(fieldValue);
    case "gt":
      return (
        typeof fieldValue === "number" && typeof ruleValue === "number" && fieldValue > ruleValue
      );
    case "lt":
      return (
        typeof fieldValue === "number" && typeof ruleValue === "number" && fieldValue < ruleValue
      );
    case "contains":
      return (
        typeof fieldValue === "string" &&
        typeof ruleValue === "string" &&
        fieldValue.includes(ruleValue)
      );
    default:
      return false;
  }
};

const matchesRule = (
  user: unknown,
  rule: FeatureFlagRule,
  segments: Record<string, SegmentFunction>
): boolean => {
  if (rule.segment) {
    const segmentFn = segments[rule.segment];
    if (!segmentFn) {
      logger.warn(`Segment function not found: ${rule.segment}`);
      return false;
    }
    try {
      return segmentFn(user);
    } catch (err) {
      logger.warn(`Segment function "${rule.segment}" threw: ${err}`);
      return false;
    }
  }

  return matchesFieldRule(user, rule);
};

/**
 * Evaluate a single feature flag for a user.
 * Returns boolean for boolean flags, string key for variant flags, or null for disabled variant flags.
 */
export const evaluateFlag = (
  flag: FeatureFlagDocument,
  userId: string,
  user: unknown,
  segments: Record<string, SegmentFunction>
): boolean | string | null => {
  if (!flag.enabled) {
    return flag.type === "variant" ? null : false;
  }

  // Check rules in order — first match wins
  for (const rule of flag.rules) {
    if (matchesRule(user, rule, segments)) {
      if (flag.type === "variant") {
        return rule.variant ?? null;
      }
      return rule.enabled ?? false;
    }
  }

  // No rules matched — use deterministic hashing
  const hash = deterministicHash(`${userId}${flag.key}`);

  if (flag.type === "boolean") {
    return hash < flag.rolloutPercentage;
  }

  // Variant assignment based on cumulative weights
  let cumulativeWeight = 0;
  for (const variant of flag.variants) {
    cumulativeWeight += variant.weight;
    if (hash < cumulativeWeight) {
      return variant.key;
    }
  }

  // Fallback (shouldn't happen if weights sum to 100)
  return flag.variants.length > 0 ? flag.variants[flag.variants.length - 1].key : null;
};

/**
 * Evaluate all enabled, non-archived feature flags for a user.
 * Returns a map of flag key to evaluation result.
 */
export const evaluateAllFlags = async (
  flagModel: typeof import("./featureFlagModel").FeatureFlag,
  userId: string,
  user: unknown,
  segments: Record<string, SegmentFunction>
): Promise<EvaluationResult> => {
  const flags = await flagModel.find({archived: {$ne: true}, enabled: true});
  const results: EvaluationResult = {};

  for (const flag of flags) {
    results[flag.key] = evaluateFlag(flag, userId, user, segments);
  }

  return results;
};
