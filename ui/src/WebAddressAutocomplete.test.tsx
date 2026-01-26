import {describe, expect, it} from "bun:test";

import {WebAddressAutocomplete} from "./WebAddressAutocomplete";

describe("WebAddressAutocomplete", () => {
  // WebAddressAutocomplete uses Google Places API
  it.skip("renders correctly (skipped - uses Google Places API)", () => {
    expect(WebAddressAutocomplete).toBeDefined();
  });

  it("component is defined", () => {
    expect(WebAddressAutocomplete).toBeDefined();
    expect(typeof WebAddressAutocomplete).toBe("function");
  });
});
