import {describe, expect, it} from "bun:test";

import {excerptBody} from "./excerpt.js";

describe("excerptBody", () => {
  it("returns trimmed text when under the max length", () => {
    expect(excerptBody("  hello   world  ")).toBe("hello world");
  });

  it("truncates long bodies with an ellipsis", () => {
    const longBody = "a".repeat(300);
    expect(excerptBody(longBody, 240)).toBe(`${"a".repeat(240)}…`);
  });
});
