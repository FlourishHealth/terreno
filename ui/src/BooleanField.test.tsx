import {describe, expect, it} from "bun:test";

import {BooleanField} from "./BooleanField";

// BooleanField uses Animated API which is not fully supported in the test environment.
// These tests are skipped due to Animated.parallel not being available in bun test.
describe("BooleanField", () => {
  it.skip("renders correctly (skipped - Animated API not supported in test environment)", () => {
    // BooleanField uses React Native Animated API which requires native modules
    expect(BooleanField).toBeDefined();
  });

  it("component is defined", () => {
    expect(BooleanField).toBeDefined();
    expect(typeof BooleanField).toBe("function");
  });
});
