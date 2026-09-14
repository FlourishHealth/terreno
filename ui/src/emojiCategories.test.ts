import {describe, expect, it} from "bun:test";

import {Categories} from "./emojiCategories";

describe("emojiCategories", () => {
  it("exports the All category as a stable object", () => {
    expect(Categories.all).toEqual({name: "All", symbol: null});
    expect(Categories.people.symbol).toBe("🧑");
    expect(Object.keys(Categories).sort()).toEqual([
      "activities",
      "all",
      "emotion",
      "flags",
      "food",
      "history",
      "nature",
      "objects",
      "people",
      "places",
      "symbols",
    ]);
  });
});
