import {beforeEach, describe, expect, it} from "bun:test";
import {assert} from "chai";

import {getAiSessionId, resetAiSessionId} from "./aiSession";

describe("getAiSessionId", () => {
  beforeEach(() => {
    resetAiSessionId();
  });

  it("returns the same id for every call in one app run", () => {
    const first = getAiSessionId();
    assert.isNotEmpty(first);
    assert.equal(getAiSessionId(), first);
  });

  it("mints a new id after a reset", () => {
    const first = getAiSessionId();
    resetAiSessionId();
    expect(getAiSessionId()).not.toBe(first);
  });
});
