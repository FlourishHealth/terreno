import {describe, expect, it} from "bun:test";

import {SplitPage} from "./SplitPage";

describe("SplitPage", () => {
  // SplitPage uses react-native-swiper-flatlist and complex FlatList interactions
  it.skip("renders correctly (skipped - uses react-native-swiper-flatlist)", () => {
    expect(SplitPage).toBeDefined();
  });

  it("component is defined", () => {
    expect(SplitPage).toBeDefined();
    expect(typeof SplitPage).toBe("function");
  });
});
