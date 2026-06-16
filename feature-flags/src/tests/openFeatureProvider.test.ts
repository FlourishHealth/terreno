import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {ErrorCode, OpenFeature, StandardResolutionReasons} from "@openfeature/server-sdk";
import {setupDb} from "@terreno/api/src/tests";

import {FeatureFlag} from "../featureFlagModel";
import {MongoFeatureFlagProvider} from "../openFeatureProvider";
import type {SegmentFunction} from "../types";

const noopLogger = {
  debug: (): void => {},
  error: (): void => {},
  info: (): void => {},
  warn: (): void => {},
} as const;

describe("MongoFeatureFlagProvider", () => {
  let provider: MongoFeatureFlagProvider;

  beforeEach(async () => {
    await setupDb();
    await FeatureFlag.deleteMany({});
    provider = new MongoFeatureFlagProvider({flagModel: FeatureFlag, segments: {}});
    await OpenFeature.clearProviders();
  });

  afterEach(async () => {
    await FeatureFlag.deleteMany({});
    await OpenFeature.clearProviders();
  });

  it("returns FLAG_NOT_FOUND for a missing flag", async () => {
    const res = await provider.resolveBooleanEvaluation(
      "nope",
      false,
      {targetingKey: "u1"},
      noopLogger
    );
    expect(res.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
    expect(res.reason).toBe(StandardResolutionReasons.ERROR);
    expect(res.value).toBe(false);
  });

  it("returns TYPE_MISMATCH when resolveStringEvaluation targets a boolean flag", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "bool-only",
      name: "Bool",
      rolloutPercentage: 100,
      type: "boolean",
    });
    const res = await provider.resolveStringEvaluation(
      "bool-only",
      "x",
      {targetingKey: "u1"},
      noopLogger
    );
    expect(res.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
    expect(res.value).toBe("x");
  });

  it("returns TYPE_MISMATCH when resolveBooleanEvaluation targets a variant flag", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "var-only",
      name: "Var",
      rules: [],
      type: "variant",
      variants: [
        {key: "a", weight: 50},
        {key: "b", weight: 50},
      ],
    });
    const res = await provider.resolveBooleanEvaluation(
      "var-only",
      false,
      {targetingKey: "u1"},
      noopLogger
    );
    expect(res.errorCode).toBe(ErrorCode.TYPE_MISMATCH);
  });

  it("returns DISABLED with defaultValue for a disabled boolean flag", async () => {
    await FeatureFlag.create({
      defaultVariant: "on",
      enabled: false,
      key: "disabled-bool",
      name: "Off",
      rolloutPercentage: 100,
      type: "boolean",
    });
    const res = await provider.resolveBooleanEvaluation(
      "disabled-bool",
      false,
      {targetingKey: "u1"},
      noopLogger
    );
    expect(res.reason).toBe(StandardResolutionReasons.DISABLED);
    expect(res.value).toBe(false);
    expect(res.variant).toBe("on");
  });

  it("resolves boolean rollout via deterministic hash when no rules match", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "rollout",
      name: "Rollout",
      rolloutPercentage: 100,
      rules: [],
      type: "boolean",
    });
    const res = await provider.resolveBooleanEvaluation(
      "rollout",
      false,
      {targetingKey: "user-abc"},
      noopLogger
    );
    expect(res.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
    expect(res.value).toBe(true);
    expect(res.variant).toBe("on");
  });

  it("matches a field rule on a boolean flag", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "rule-bool",
      name: "Rule",
      rolloutPercentage: 0,
      rules: [{enabled: true, field: "admin", operator: "eq", value: true}],
      type: "boolean",
    });
    const adminRes = await provider.resolveBooleanEvaluation(
      "rule-bool",
      false,
      {targetingKey: "id1", user: {admin: true}},
      noopLogger
    );
    expect(adminRes.value).toBe(true);

    const userRes = await provider.resolveBooleanEvaluation(
      "rule-bool",
      false,
      {targetingKey: "id2", user: {admin: false}},
      noopLogger
    );
    expect(userRes.value).toBe(false);
  });

  it("matches a segment rule when segments are registered", async () => {
    const segments: Record<string, SegmentFunction> = {
      "vip-users": (u: unknown) => (u as {vip?: boolean}).vip === true,
    };
    const p = new MongoFeatureFlagProvider({flagModel: FeatureFlag, segments});
    await FeatureFlag.create({
      enabled: true,
      key: "seg-flag",
      name: "Seg",
      rolloutPercentage: 0,
      rules: [{enabled: true, segment: "vip-users"}],
      type: "boolean",
    });
    const yes = await p.resolveBooleanEvaluation(
      "seg-flag",
      false,
      {targetingKey: "x", user: {vip: true}},
      noopLogger
    );
    expect(yes.value).toBe(true);
    const no = await p.resolveBooleanEvaluation(
      "seg-flag",
      false,
      {targetingKey: "y", user: {vip: false}},
      noopLogger
    );
    expect(no.value).toBe(false);
  });

  it("treats missing targetingKey as empty string for hashing", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "hash-key",
      name: "Hash",
      rolloutPercentage: 100,
      rules: [],
      type: "boolean",
    });
    const res = await provider.resolveBooleanEvaluation("hash-key", false, {}, noopLogger);
    expect(res.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
    expect(typeof res.value).toBe("boolean");
  });

  it("uses flat context as user when user field is absent", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "flat-ctx",
      name: "Flat",
      rolloutPercentage: 0,
      rules: [{enabled: true, field: "admin", operator: "eq", value: true}],
      type: "boolean",
    });
    const res = await provider.resolveBooleanEvaluation(
      "flat-ctx",
      false,
      {admin: true, targetingKey: "t1"} as never,
      noopLogger
    );
    expect(res.value).toBe(true);
  });

  it("resolves variant assignment and returns TARGETING_MATCH", async () => {
    await FeatureFlag.create({
      enabled: true,
      key: "layout",
      name: "Layout",
      rules: [],
      type: "variant",
      variants: [
        {key: "compact", weight: 50},
        {key: "detailed", weight: 50},
      ],
    });
    const res = await provider.resolveStringEvaluation(
      "layout",
      "fallback",
      {targetingKey: "user-z"},
      noopLogger
    );
    expect(res.reason).toBe(StandardResolutionReasons.TARGETING_MATCH);
    expect(["compact", "detailed"].includes(res.value)).toBe(true);
  });

  it("returns DISABLED for variant flag when evaluateFlag yields null", async () => {
    await FeatureFlag.create({
      defaultVariant: "compact",
      enabled: false,
      key: "var-off",
      name: "Var off",
      rules: [],
      type: "variant",
      variants: [
        {key: "compact", weight: 50},
        {key: "detailed", weight: 50},
      ],
    });
    const res = await provider.resolveStringEvaluation(
      "var-off",
      "fallback",
      {targetingKey: "u1"},
      noopLogger
    );
    expect(res.reason).toBe(StandardResolutionReasons.DISABLED);
    expect(res.value).toBe("fallback");
    expect(res.variant).toBe("compact");
  });

  it("resolveNumberEvaluation returns FLAG_NOT_FOUND with default", async () => {
    const res = await provider.resolveNumberEvaluation("any", 42, {targetingKey: "u"}, noopLogger);
    expect(res.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
    expect(res.value).toBe(42);
  });

  it("resolveObjectEvaluation returns FLAG_NOT_FOUND with default", async () => {
    const res = await provider.resolveObjectEvaluation(
      "any",
      {a: 1},
      {targetingKey: "u"},
      noopLogger
    );
    expect(res.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
    expect(res.value).toEqual({a: 1});
  });

  it("does not resolve archived flags", async () => {
    await FeatureFlag.create({
      archived: true,
      enabled: true,
      key: "gone",
      name: "Gone",
      rolloutPercentage: 100,
      type: "boolean",
    });
    const res = await provider.resolveBooleanEvaluation(
      "gone",
      false,
      {targetingKey: "u1"},
      noopLogger
    );
    expect(res.errorCode).toBe(ErrorCode.FLAG_NOT_FOUND);
  });
});
