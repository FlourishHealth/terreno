import {describe, expect, it} from "bun:test";

import {DateTimeActionSheet} from "./DateTimeActionSheet";

describe("DateTimeActionSheet", () => {
  // DateTimeActionSheet uses react-native-calendars and @react-native-picker/picker
  // which don't work in the test environment
  it.skip("renders correctly (skipped - uses native picker and calendar)", () => {
    expect(DateTimeActionSheet).toBeDefined();
  });

  it("component is defined", () => {
    expect(DateTimeActionSheet).toBeDefined();
    expect(typeof DateTimeActionSheet).toBe("function");
  });
});
