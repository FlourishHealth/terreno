import {afterEach, describe, expect, it} from "bun:test";
import {FeatureFlag} from "../featureFlagModel";

describe("FeatureFlag model", () => {
  afterEach(async () => {
    await FeatureFlag.deleteMany({});
  });

  it("creates a boolean flag with defaults", async () => {
    const flag = await FeatureFlag.create({
      key: "new-checkout-flow",
      name: "New Checkout Flow",
    });

    expect(flag.key).toBe("new-checkout-flow");
    expect(flag.name).toBe("New Checkout Flow");
    expect(flag.enabled).toBe(false);
    expect(flag.archived).toBe(false);
    expect(flag.type).toBe("boolean");
    expect(flag.rolloutPercentage).toBe(100);
    expect(flag.description).toBe("");
    expect(flag.rules).toEqual([]);
    expect(flag.variants).toEqual([]);
  });

  it("rejects unknown fields (strict: 'throw')", async () => {
    await expect(
      FeatureFlag.create({
        key: "strict-test",
        name: "Strict Test",
        unknownField: true,
      } as unknown as Record<string, unknown>)
    ).rejects.toBeDefined();
  });

  it("requires a key and name", async () => {
    await expect(
      FeatureFlag.create({
        name: "Missing key",
      } as unknown as Record<string, unknown>)
    ).rejects.toBeDefined();

    await expect(
      FeatureFlag.create({
        key: "missing-name",
      } as unknown as Record<string, unknown>)
    ).rejects.toBeDefined();
  });

  it("enforces unique keys", async () => {
    await FeatureFlag.syncIndexes();

    await FeatureFlag.create({key: "dup-key", name: "First"});
    await expect(FeatureFlag.create({key: "dup-key", name: "Second"})).rejects.toBeDefined();
  });

  it("clamps rolloutPercentage to the 0-100 range", async () => {
    await expect(
      FeatureFlag.create({
        key: "over-rollout",
        name: "Over",
        rolloutPercentage: 150,
      })
    ).rejects.toBeDefined();

    await expect(
      FeatureFlag.create({
        key: "under-rollout",
        name: "Under",
        rolloutPercentage: -5,
      })
    ).rejects.toBeDefined();
  });

  it("accepts variant flags with variants that sum to 100", async () => {
    const flag = await FeatureFlag.create({
      key: "variant-flag",
      name: "Variant Flag",
      type: "variant",
      variants: [
        {key: "control", weight: 40},
        {key: "variant-a", weight: 60},
      ],
    });

    expect(flag.type).toBe("variant");
    expect(flag.variants.length).toBe(2);
  });

  it("rejects variant flags with no variants", async () => {
    await expect(
      FeatureFlag.create({
        key: "variant-no-variants",
        name: "No Variants",
        type: "variant",
        variants: [],
      })
    ).rejects.toMatchObject({title: "Variant flags must have at least one variant"});
  });

  it("rejects variant flags whose variant weights do not sum to 100", async () => {
    await expect(
      FeatureFlag.create({
        key: "variant-bad-weights",
        name: "Bad Weights",
        type: "variant",
        variants: [
          {key: "control", weight: 10},
          {key: "variant-a", weight: 10},
        ],
      })
    ).rejects.toMatchObject({title: "Variant weights must sum to 100"});
  });

  it("allows boolean flags without variants", async () => {
    const flag = await FeatureFlag.create({
      key: "boolean-no-variants",
      name: "Boolean",
      type: "boolean",
    });
    expect(flag.variants).toEqual([]);
  });

  it("trims whitespace on keys", async () => {
    const flag = await FeatureFlag.create({
      key: "  padded-key  ",
      name: "Padded",
    });
    expect(flag.key).toBe("padded-key");
  });

  it("stores complex rules including segments and field rules", async () => {
    const flag = await FeatureFlag.create({
      key: "complex-rules",
      name: "Complex",
      rules: [
        {enabled: true, segment: "beta"},
        {enabled: true, field: "plan", operator: "in", value: ["pro", "enterprise"]},
        {enabled: false, field: "email", operator: "contains", value: "@example.com"},
      ],
    });
    expect(flag.rules.length).toBe(3);
    expect(flag.rules[0].segment).toBe("beta");
    expect(flag.rules[1].operator).toBe("in");
    expect(flag.rules[1].value).toEqual(["pro", "enterprise"]);
    expect(flag.rules[2].enabled).toBe(false);
  });

  it("rejects invalid rule operators via the enum constraint", async () => {
    await expect(
      FeatureFlag.create({
        key: "bad-op",
        name: "Bad Operator",
        rules: [{enabled: true, field: "plan", operator: "bogus", value: "pro"}],
      })
    ).rejects.toBeDefined();
  });

  it("rejects invalid type values via the enum constraint", async () => {
    await expect(
      FeatureFlag.create({
        key: "bad-type",
        name: "Bad Type",
        type: "nonsense",
      } as unknown as Record<string, unknown>)
    ).rejects.toBeDefined();
  });

  it("supports the isDeleted soft-delete plugin", async () => {
    const flag = await FeatureFlag.create({
      key: "soft-delete",
      name: "Soft",
    });

    expect(flag.deleted).toBe(false);

    flag.deleted = true;
    await flag.save();

    const found = await FeatureFlag.findOne({key: "soft-delete"});
    expect(found).toBeNull();

    const foundWithDeleted = await FeatureFlag.findOne({deleted: true, key: "soft-delete"});
    expect(foundWithDeleted?._id.toString()).toBe(flag._id.toString());
  });

  it("sets created/updated timestamps on save", async () => {
    const flag = await FeatureFlag.create({
      key: "timestamps",
      name: "Timestamps",
    });
    expect(flag.created).toBeInstanceOf(Date);
    expect(flag.updated).toBeInstanceOf(Date);
  });

  it("supports findExactlyOne and findOneOrNone plugins", async () => {
    await FeatureFlag.create({key: "existing-flag", name: "Exists"});

    const exact = await FeatureFlag.findExactlyOne({key: "existing-flag"});
    expect(exact.name).toBe("Exists");

    const maybe = await FeatureFlag.findOneOrNone({key: "missing-flag"});
    expect(maybe).toBeNull();
  });
});
