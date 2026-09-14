import {describe, expect, it} from "bun:test";

import {DEFAULT_APP_CONFIG, resolveAppConfig} from "./appConfig";

describe("resolveAppConfig", () => {
  it("returns defaults when no overrides are provided", () => {
    expect(resolveAppConfig()).toEqual(DEFAULT_APP_CONFIG);
  });

  it("merges partial overrides over defaults", () => {
    expect(resolveAppConfig({brandName: "Acme", providers: ["google"]})).toEqual({
      ...DEFAULT_APP_CONFIG,
      brandName: "Acme",
      providers: ["google"],
    });
  });
});
