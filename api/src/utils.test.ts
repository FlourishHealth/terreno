import {describe, expect, it} from "bun:test";

import {isValidObjectId} from "./utils";

describe("utils", () => {
  it("checks valid ObjectIds", () => {
    expect(isValidObjectId("62c44da0003d9f8ee8cc925c")).toBe(true);
    expect(isValidObjectId("620000000000000000000000")).toBe(true);
    // Mongoose's builtin "ObjectId.isValid" will falsely say this is an ObjectId.
    expect(isValidObjectId("1234567890ab")).toBe(false);
    expect(isValidObjectId("microsoft123")).toBe(false);
    expect(isValidObjectId("62c44da0003d9f8ee8cc925x")).toBe(false);
  });
});
