import {describe, expect, it} from "bun:test";

import {registerBackendPreload, registerSimpleMongoPreload} from "./registerBackendPreload";

describe("registerBackendPreload", () => {
  it("exports preload helpers", () => {
    expect(typeof registerSimpleMongoPreload).toBe("function");
    expect(typeof registerBackendPreload).toBe("function");
  });
});
