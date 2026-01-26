import {describe, expect, it} from "bun:test";

import {NumberPickerActionSheet} from "./NumberPickerActionSheet";

describe("NumberPickerActionSheet", () => {
  // NumberPickerActionSheet uses ActionSheet with Animated API and native picker
  it.skip("renders correctly (skipped - uses Animated API and native picker)", () => {
    expect(NumberPickerActionSheet).toBeDefined();
  });

  it("component is defined", () => {
    expect(NumberPickerActionSheet).toBeDefined();
    expect(typeof NumberPickerActionSheet).toBe("function");
  });
});
