import {describe, expect, it} from "bun:test";

import {generateObjectId, isObjectIdShape} from "./offlineIds";

describe("offlineIds", () => {
  it("generates ObjectId-shaped strings", () => {
    const id = generateObjectId();
    expect(isObjectIdShape(id)).toBe(true);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({length: 20}, () => generateObjectId()));
    expect(ids.size).toBe(20);
  });
});
