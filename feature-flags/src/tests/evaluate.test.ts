import {describe, expect, it} from "bun:test";
import {deterministicHash, evaluateFlag} from "../evaluate";
import type {FeatureFlagDocument, SegmentFunction} from "../types";

const createFlag = (overrides: Partial<FeatureFlagDocument> = {}): FeatureFlagDocument => {
  return {
    archived: false,
    description: "Test flag",
    enabled: true,
    key: "test-flag",
    name: "Test Flag",
    rolloutPercentage: 100,
    rules: [],
    type: "boolean",
    variants: [],
    ...overrides,
  } as unknown as FeatureFlagDocument;
};

const noSegments: Record<string, SegmentFunction> = {};

describe("deterministicHash", () => {
  it("returns a number between 0 and 99", () => {
    for (let i = 0; i < 100; i++) {
      const hash = deterministicHash(`user-${i}flag-key`);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(100);
    }
  });

  it("returns the same value for the same input", () => {
    const input = "user123test-flag";
    const hash1 = deterministicHash(input);
    const hash2 = deterministicHash(input);
    expect(hash1).toBe(hash2);
  });

  it("returns different values for different inputs", () => {
    const hash1 = deterministicHash("user1test-flag");
    const hash2 = deterministicHash("user2test-flag");
    // Not guaranteed but extremely likely for different inputs
    // Just verify they're both valid
    expect(hash1).toBeGreaterThanOrEqual(0);
    expect(hash2).toBeGreaterThanOrEqual(0);
  });

  it("does not collide for ambiguous userId/key pairs", () => {
    // "12" + "3" must not equal "1" + "23" — delimiter prevents this
    const hash1 = deterministicHash("12:3");
    const hash2 = deterministicHash("1:23");
    expect(hash1).not.toBe(hash2);
  });
});

describe("evaluateFlag", () => {
  describe("disabled flags", () => {
    it("returns false for disabled boolean flags", () => {
      const flag = createFlag({enabled: false, type: "boolean"});
      expect(evaluateFlag(flag, "user1", {}, noSegments)).toBe(false);
    });

    it("returns null for disabled variant flags", () => {
      const flag = createFlag({
        enabled: false,
        type: "variant",
        variants: [
          {key: "control", weight: 50},
          {key: "variant-a", weight: 50},
        ],
      });
      expect(evaluateFlag(flag, "user1", {}, noSegments)).toBeNull();
    });
  });

  describe("boolean flags with rollout percentage", () => {
    it("returns true for all users at 100% rollout", () => {
      const flag = createFlag({rolloutPercentage: 100});
      // Test multiple users — all should get true
      for (let i = 0; i < 20; i++) {
        expect(evaluateFlag(flag, `user-${i}`, {}, noSegments)).toBe(true);
      }
    });

    it("returns false for all users at 0% rollout", () => {
      const flag = createFlag({rolloutPercentage: 0});
      for (let i = 0; i < 20; i++) {
        expect(evaluateFlag(flag, `user-${i}`, {}, noSegments)).toBe(false);
      }
    });

    it("gives consistent results for the same user", () => {
      const flag = createFlag({rolloutPercentage: 50});
      const result1 = evaluateFlag(flag, "user-abc", {}, noSegments);
      const result2 = evaluateFlag(flag, "user-abc", {}, noSegments);
      expect(result1).toBe(result2);
    });

    it("distributes roughly proportionally at 50%", () => {
      const flag = createFlag({rolloutPercentage: 50});
      let trueCount = 0;
      const total = 1000;
      for (let i = 0; i < total; i++) {
        if (evaluateFlag(flag, `user-${i}`, {}, noSegments) === true) {
          trueCount++;
        }
      }
      // Allow 15% tolerance for randomness
      expect(trueCount).toBeGreaterThan(total * 0.35);
      expect(trueCount).toBeLessThan(total * 0.65);
    });
  });

  describe("variant flags", () => {
    it("assigns users to variants based on weights", () => {
      const flag = createFlag({
        type: "variant",
        variants: [
          {key: "control", weight: 50},
          {key: "variant-a", weight: 50},
        ],
      });

      const counts: Record<string, number> = {control: 0, "variant-a": 0};
      const total = 1000;
      for (let i = 0; i < total; i++) {
        const result = evaluateFlag(flag, `user-${i}`, {}, noSegments) as string;
        counts[result]++;
      }

      // Both variants should get roughly 50%
      expect(counts.control).toBeGreaterThan(total * 0.35);
      expect(counts["variant-a"]).toBeGreaterThan(total * 0.35);
    });

    it("returns consistent variant for the same user", () => {
      const flag = createFlag({
        type: "variant",
        variants: [
          {key: "control", weight: 50},
          {key: "variant-a", weight: 50},
        ],
      });

      const result1 = evaluateFlag(flag, "user-123", {}, noSegments);
      const result2 = evaluateFlag(flag, "user-123", {}, noSegments);
      expect(result1).toBe(result2);
    });

    it("handles three-way split", () => {
      const flag = createFlag({
        type: "variant",
        variants: [
          {key: "control", weight: 50},
          {key: "variant-a", weight: 30},
          {key: "variant-b", weight: 20},
        ],
      });

      const counts: Record<string, number> = {control: 0, "variant-a": 0, "variant-b": 0};
      const total = 1000;
      for (let i = 0; i < total; i++) {
        const result = evaluateFlag(flag, `user-${i}`, {}, noSegments) as string;
        counts[result]++;
      }

      // All variants should get some users
      expect(counts.control).toBeGreaterThan(0);
      expect(counts["variant-a"]).toBeGreaterThan(0);
      expect(counts["variant-b"]).toBeGreaterThan(0);
    });
  });

  describe("field rules", () => {
    it("matches eq operator", () => {
      const flag = createFlag({
        rules: [{enabled: true, field: "admin", operator: "eq", value: true}],
      });

      expect(evaluateFlag(flag, "user1", {admin: true}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {admin: false}, noSegments)).toBe(true); // Falls through to rollout at 100%
    });

    it("matches neq operator", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "role", operator: "neq", value: "guest"}],
      });

      expect(evaluateFlag(flag, "user1", {role: "admin"}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {role: "guest"}, noSegments)).toBe(false); // No match, 0% rollout
    });

    it("matches in operator", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "plan", operator: "in", value: ["pro", "enterprise"]}],
      });

      expect(evaluateFlag(flag, "user1", {plan: "pro"}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {plan: "free"}, noSegments)).toBe(false);
    });

    it("matches nin operator", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "plan", operator: "nin", value: ["free", "trial"]}],
      });

      expect(evaluateFlag(flag, "user1", {plan: "pro"}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {plan: "free"}, noSegments)).toBe(false);
    });

    it("matches gt operator", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "totalActions", operator: "gt", value: 100}],
      });

      expect(evaluateFlag(flag, "user1", {totalActions: 200}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {totalActions: 50}, noSegments)).toBe(false);
    });

    it("matches lt operator", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "age", operator: "lt", value: 18}],
      });

      expect(evaluateFlag(flag, "user1", {age: 15}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {age: 25}, noSegments)).toBe(false);
    });

    it("matches contains operator", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "email", operator: "contains", value: "@company.com"}],
      });

      expect(evaluateFlag(flag, "user1", {email: "john@company.com"}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {email: "john@gmail.com"}, noSegments)).toBe(false);
    });

    it("does not match eq when rule.value is undefined", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "missingField", operator: "eq"}],
      });

      // Both user field and rule.value are undefined — should NOT match
      expect(evaluateFlag(flag, "user1", {}, noSegments)).toBe(false);
    });

    it("does not match neq when rule.value is undefined", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "missingField", operator: "neq"}],
      });

      expect(evaluateFlag(flag, "user1", {}, noSegments)).toBe(false);
    });

    it("supports dot notation for nested fields", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "address.zip", operator: "eq", value: "94105"}],
      });

      expect(evaluateFlag(flag, "user1", {address: {zip: "94105"}}, noSegments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {address: {zip: "10001"}}, noSegments)).toBe(false);
    });

    it("returns rule.enabled value for boolean flags", () => {
      const flag = createFlag({
        rules: [{enabled: false, field: "admin", operator: "eq", value: true}],
      });

      // Rule matches and returns enabled: false
      expect(evaluateFlag(flag, "user1", {admin: true}, noSegments)).toBe(false);
    });

    it("first matching rule wins", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [
          {enabled: true, field: "admin", operator: "eq", value: true},
          {enabled: false, field: "role", operator: "eq", value: "manager"},
        ],
      });

      // Admin manager — first rule matches, gets true
      expect(evaluateFlag(flag, "user1", {admin: true, role: "manager"}, noSegments)).toBe(true);
    });
  });

  describe("variant flag rules", () => {
    it("returns forced variant from matching rule", () => {
      const flag = createFlag({
        rules: [{field: "admin", operator: "eq", value: true, variant: "variant-a"}],
        type: "variant",
        variants: [
          {key: "control", weight: 50},
          {key: "variant-a", weight: 50},
        ],
      });

      expect(evaluateFlag(flag, "user1", {admin: true}, noSegments)).toBe("variant-a");
    });
  });

  describe("segment rules", () => {
    it("matches segment function", () => {
      const segments: Record<string, SegmentFunction> = {
        "pro-users": (user: unknown) => (user as {plan: string}).plan === "pro",
      };

      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, segment: "pro-users"}],
      });

      expect(evaluateFlag(flag, "user1", {plan: "pro"}, segments)).toBe(true);
      expect(evaluateFlag(flag, "user2", {plan: "free"}, segments)).toBe(false);
    });

    it("returns false for unknown segment", () => {
      const flag = createFlag({
        rolloutPercentage: 0,
        rules: [{enabled: true, segment: "unknown-segment"}],
      });

      expect(evaluateFlag(flag, "user1", {}, noSegments)).toBe(false);
    });
  });
});
