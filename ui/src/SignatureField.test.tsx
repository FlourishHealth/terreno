import {describe, expect, it} from "bun:test";

import {SignatureField} from "./SignatureField";

describe("SignatureField", () => {
  // SignatureField uses react-signature-canvas which requires a canvas/DOM environment
  // that isn't available in the bun test environment
  it.skip("renders correctly (skipped - requires canvas environment)", () => {
    expect(SignatureField).toBeDefined();
  });

  it("component is defined", () => {
    expect(SignatureField).toBeDefined();
    expect(typeof SignatureField).toBe("function");
  });
});
