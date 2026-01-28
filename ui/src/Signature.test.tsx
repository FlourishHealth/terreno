import {describe, expect, it} from "bun:test";

import {Signature} from "./Signature";

describe("Signature", () => {
  // Signature uses react-signature-canvas which requires a canvas/DOM environment
  it.skip("renders correctly (skipped - requires canvas environment)", () => {
    expect(Signature).toBeDefined();
  });

  it("component is defined", () => {
    expect(Signature).toBeDefined();
    expect(typeof Signature).toBe("function");
  });
});
