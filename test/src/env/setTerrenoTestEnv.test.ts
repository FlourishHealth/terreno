import {afterEach, describe, expect, it} from "bun:test";

import {setTerrenoTestEnv} from "./setTerrenoTestEnv";

afterEach(() => {
  setTerrenoTestEnv();
});

describe("setTerrenoTestEnv", () => {
  it("applies extra keys and deletes undefined extra values", () => {
    process.env.FEATURE_FLAGS_DEBUG = "true";
    setTerrenoTestEnv({
      extra: {FEATURE_FLAGS_DEBUG: undefined, TRACE: "1"},
    });
    expect(process.env.TRACE).toBe("1");
    expect(process.env.FEATURE_FLAGS_DEBUG).toBeUndefined();
  });

  it("deletes listed keys after applying defaults", () => {
    setTerrenoTestEnv({
      extra: {TRACE: "1"},
      deleteKeys: ["TRACE"],
    });
    expect(process.env.TRACE).toBeUndefined();
  });
});
