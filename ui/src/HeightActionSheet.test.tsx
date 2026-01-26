import {describe, expect, it} from "bun:test";

import {HeightActionSheet} from "./HeightActionSheet";

describe("HeightActionSheet", () => {
  // HeightActionSheet uses ActionSheet with Animated API and native picker
  it.skip("renders correctly (skipped - uses Animated API and native picker)", () => {
    expect(HeightActionSheet).toBeDefined();
  });

  it("component is defined", () => {
    expect(HeightActionSheet).toBeDefined();
    expect(typeof HeightActionSheet).toBe("function");
  });
});
