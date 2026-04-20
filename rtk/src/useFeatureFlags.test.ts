import {describe, expect, it} from "bun:test";
import {resolveFeatureFlagsOptions} from "./useFeatureFlags";

describe("resolveFeatureFlagsOptions", () => {
  it("applies defaults when no argument is provided", () => {
    expect(resolveFeatureFlagsOptions()).toEqual({
      basePath: "/feature-flags",
      skip: false,
    });
  });

  it("applies defaults when an empty options object is provided", () => {
    expect(resolveFeatureFlagsOptions({})).toEqual({
      basePath: "/feature-flags",
      skip: false,
    });
  });

  it("treats a string argument as a legacy basePath with skip=false", () => {
    expect(resolveFeatureFlagsOptions("/custom-path")).toEqual({
      basePath: "/custom-path",
      skip: false,
    });
  });

  it("preserves an empty string basePath when passed as a legacy string argument", () => {
    expect(resolveFeatureFlagsOptions("")).toEqual({
      basePath: "",
      skip: false,
    });
  });

  it("uses options.basePath when provided", () => {
    expect(resolveFeatureFlagsOptions({basePath: "/flags"})).toEqual({
      basePath: "/flags",
      skip: false,
    });
  });

  it("uses options.skip when provided", () => {
    expect(resolveFeatureFlagsOptions({skip: true})).toEqual({
      basePath: "/feature-flags",
      skip: true,
    });
  });

  it("uses both options.basePath and options.skip when provided together", () => {
    expect(resolveFeatureFlagsOptions({basePath: "/flags", skip: true})).toEqual({
      basePath: "/flags",
      skip: true,
    });
  });

  it("does not let a legacy string basePath override skip to true", () => {
    expect(resolveFeatureFlagsOptions("/custom-path").skip).toBe(false);
  });
});
