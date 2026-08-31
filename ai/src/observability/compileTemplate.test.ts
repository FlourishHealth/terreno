import {describe, expect, it} from "bun:test";

import {compileTemplate} from "./compileTemplate";

describe("compileTemplate", () => {
  it("replaces {{var}} placeholders from the variable map", () => {
    expect(compileTemplate("Hello {{name}}", {name: "Ada"})).toBe("Hello Ada");
  });
});
