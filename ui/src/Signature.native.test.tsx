import {describe, expect, it} from "bun:test";

import {getSignaturePadHeight} from "./SignatureSizing";

describe("Signature native sizing", () => {
  it("uses a smaller signature pad on iOS", () => {
    expect(getSignaturePadHeight("ios")).toBeLessThan(getSignaturePadHeight("android"));
  });
});
