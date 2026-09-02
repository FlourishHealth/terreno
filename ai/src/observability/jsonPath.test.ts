import {describe, it} from "bun:test";
import {assert} from "chai";

import {getValueAtPath, setValueAtPath} from "./jsonPath";

describe("jsonPath", () => {
  it("returns the root value for empty paths", () => {
    const value = {answer: 4};
    assert.deepEqual(getValueAtPath(value, ""), value);
    assert.deepEqual(getValueAtPath(value, "."), value);
  });

  it("reads nested values and stops on missing segments", () => {
    assert.equal(getValueAtPath({answer: {text: "ok"}}, "answer.text"), "ok");
    assert.isUndefined(getValueAtPath({answer: 1}, "answer.text"));
    assert.isUndefined(getValueAtPath(null, "answer"));
  });

  it("creates intermediate objects when setting nested paths", () => {
    const target: Record<string, unknown> = {};
    setValueAtPath(target, "input.text", "hello");
    assert.deepEqual(target, {input: {text: "hello"}});

    const flat: Record<string, unknown> = {input: "raw"};
    setValueAtPath(flat, "input.text", "nested");
    assert.deepEqual(flat.input, {text: "nested"});
  });

  it("ignores empty path segments when setting values", () => {
    const target: Record<string, unknown> = {};
    setValueAtPath(target, "", "ignored");
    assert.deepEqual(target, {});
  });
});
