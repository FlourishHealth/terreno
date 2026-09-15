import {describe, it} from "bun:test";
import {assert} from "chai";
import {register} from "tsx/esm/api";

describe("tsx", (): void => {
  it("exports a register function for the TypeScript loader", (): void => {
    assert.equal(typeof register, "function");
  });
});
