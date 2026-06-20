import {describe, expect, it} from "bun:test";

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

describe("generate-component-docs helpers", () => {
  it("slugifies component names for doc filenames", () => {
    expect(slugify("Text field")).toBe("text-field");
    expect(slugify("Sidebar Navigation")).toBe("sidebar-navigation");
    expect(slugify("AI Suggestion Box")).toBe("ai-suggestion-box");
  });
});
