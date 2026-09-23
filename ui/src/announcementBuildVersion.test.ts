import {afterEach, describe, it, mock} from "bun:test";
import {assert} from "chai";

const constantsState = {
  expoConfig: {
    extra: {
      buildNumber: undefined as number | string | undefined,
    },
  },
};

mock.module("expo-constants", () => ({
  default: constantsState,
}));

const {getAnnouncementBuildVersion} = await import("./announcementBuildVersion");

describe("getAnnouncementBuildVersion", () => {
  afterEach(() => {
    constantsState.expoConfig.extra.buildNumber = undefined;
  });

  it("returns a finite integer build number from Expo config", () => {
    constantsState.expoConfig.extra.buildNumber = 42;
    assert.strictEqual(getAnnouncementBuildVersion(), 42);
  });

  it("coerces string build numbers to integers", () => {
    constantsState.expoConfig.extra.buildNumber = "17";
    assert.strictEqual(getAnnouncementBuildVersion(), 17);
  });

  it("omits invalid or missing build numbers", () => {
    constantsState.expoConfig.extra.buildNumber = undefined;
    assert.isUndefined(getAnnouncementBuildVersion());

    constantsState.expoConfig.extra.buildNumber = "not-a-number";
    assert.isUndefined(getAnnouncementBuildVersion());

    constantsState.expoConfig.extra.buildNumber = Number.NaN;
    assert.isUndefined(getAnnouncementBuildVersion());
  });
});
