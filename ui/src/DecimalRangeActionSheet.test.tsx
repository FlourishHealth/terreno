import {describe, expect, it} from "bun:test";

import {DecimalRangeActionSheet} from "./DecimalRangeActionSheet";

describe("DecimalRangeActionSheet", () => {
  // DecimalRangeActionSheet uses ActionSheet with Animated API
  it.skip("renders correctly (skipped - uses Animated API)", () => {
    expect(DecimalRangeActionSheet).toBeDefined();
  });

  it("component is defined", () => {
    expect(DecimalRangeActionSheet).toBeDefined();
    expect(typeof DecimalRangeActionSheet).toBe("function");
  });
});
