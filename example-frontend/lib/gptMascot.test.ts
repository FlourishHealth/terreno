import {describe, it} from "bun:test";
import {assert} from "chai";

import {selectGptMascotIndex} from "./gptMascot";

describe("selectGptMascotIndex", () => {
  it("maps the random range across all four mascots", () => {
    assert.equal(selectGptMascotIndex(0), 0);
    assert.equal(selectGptMascotIndex(0.249), 0);
    assert.equal(selectGptMascotIndex(0.25), 1);
    assert.equal(selectGptMascotIndex(0.5), 2);
    assert.equal(selectGptMascotIndex(0.999), 3);
  });

  it("falls back to the first mascot outside Math.random's range", () => {
    assert.equal(selectGptMascotIndex(-0.1), 0);
    assert.equal(selectGptMascotIndex(1), 0);
  });
});
