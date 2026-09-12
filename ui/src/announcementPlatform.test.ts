import {afterEach, describe, expect, it} from "bun:test";
import {Platform} from "react-native";

import {getAnnouncementPlatform} from "./announcementPlatform";

describe("getAnnouncementPlatform", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("returns ios on iOS clients", () => {
    Platform.OS = "ios";
    expect(getAnnouncementPlatform()).toBe("ios");
  });

  it("returns android on Android clients", () => {
    Platform.OS = "android";
    expect(getAnnouncementPlatform()).toBe("android");
  });

  it("returns web on other platforms", () => {
    Platform.OS = "web";
    expect(getAnnouncementPlatform()).toBe("web");
  });
});
