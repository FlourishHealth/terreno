import {describe, it} from "bun:test";
import {assert} from "chai";
import type {Request} from "express";

import {headerValue} from "./headerValue";

describe("headerValue", () => {
  it("returns the first value when the header is an array", () => {
    const req = {headers: {"x-sig": ["first", "second"]}} as unknown as Request;
    assert.equal(headerValue(req, "X-Sig"), "first");
  });

  it("returns a string header", () => {
    const req = {headers: {"x-sig": "abc"}} as unknown as Request;
    assert.equal(headerValue(req, "X-Sig"), "abc");
  });

  it("returns undefined when the header is missing", () => {
    const req = {headers: {}} as unknown as Request;
    assert.isUndefined(headerValue(req, "X-Sig"));
  });
});
