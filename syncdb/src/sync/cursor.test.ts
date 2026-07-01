import {describe, expect, it} from "bun:test";

import {isCursorAfter, streamForCollection} from "./cursor";

describe("isCursorAfter", () => {
  it("compares numeric cursors numerically (multi-digit)", () => {
    expect(isCursorAfter("10", "9")).toBe(true);
    expect(isCursorAfter("9", "10")).toBe(false);
    expect(isCursorAfter("100", "99")).toBe(true);
    expect(isCursorAfter("2", "2")).toBe(false);
  });

  it("falls back to lexicographic order for non-numeric cursors", () => {
    expect(isCursorAfter("b", "a")).toBe(true);
    expect(isCursorAfter("a", "b")).toBe(false);
  });
});

describe("streamForCollection", () => {
  it("scopes owner streams and falls back to the bare collection", () => {
    expect(streamForCollection({collection: "todos", ownerId: "u1"})).toBe("todos:u1");
    expect(streamForCollection({collection: "todos"})).toBe("todos");
  });
});
