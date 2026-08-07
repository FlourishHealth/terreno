import {afterEach, describe, expect, it} from "bun:test";
import {Platform} from "react-native";

import {
  CONTROL_MIN_HEIGHT,
  CONTROL_SM_MIN_HEIGHT,
  controlHitSlop,
  TOUCH_TARGET_MIN,
} from "./ControlSizes";

const originalPlatform = Platform.OS;

const setPlatform = (os: typeof Platform.OS): void => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: os, writable: true});
};

describe("ControlSizes", () => {
  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it("uses Apple's recommended 44pt control size", () => {
    expect(CONTROL_MIN_HEIGHT).toBe(44);
  });

  it("keeps the dense size at Apple's documented iOS minimum", () => {
    expect(CONTROL_SM_MIN_HEIGHT).toBe(28);
  });

  it("uses Material's recommended 48dp touch target", () => {
    expect(TOUCH_TARGET_MIN).toBe(48);
  });

  it("expands a 44pt control to Material's 48dp target", () => {
    setPlatform("ios");
    expect(controlHitSlop(CONTROL_MIN_HEIGHT)).toEqual({bottom: 2, top: 2});
  });

  it("expands a compact 32pt control to a 48dp target", () => {
    setPlatform("android");
    expect(controlHitSlop(32)).toEqual({bottom: 8, top: 8});
  });

  it("rounds up so an odd shortfall still clears the target", () => {
    setPlatform("ios");
    expect(controlHitSlop(37)).toEqual({bottom: 6, top: 6});
  });

  it("returns no slop for controls that already meet the target", () => {
    setPlatform("ios");
    expect(controlHitSlop(TOUCH_TARGET_MIN)).toBeUndefined();
    expect(controlHitSlop(64)).toBeUndefined();
  });

  it("returns no slop on web, where react-native-web ignores hitSlop", () => {
    setPlatform("web");
    expect(controlHitSlop(CONTROL_MIN_HEIGHT)).toBeUndefined();
    expect(controlHitSlop(20)).toBeUndefined();
  });
});
