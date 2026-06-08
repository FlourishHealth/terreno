import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {Platform} from "react-native";

import {SelectBadge} from "./SelectBadge";
import {renderWithTheme} from "./test-utils";

// Force Platform.OS to "android" for this file so SelectBadge takes the
// renderPicker branch (native Picker overlay) instead of the iOS modal.
const originalOS = Platform.OS;
beforeAll(() => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: "android"});
});
afterAll(() => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: originalOS});
});

describe("SelectBadge (android)", () => {
  const options = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
    {label: "Option C", value: "c"},
  ];

  it("renders the Android-native Picker overlay", () => {
    const {UNSAFE_getAllByProps, toJSON} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={options} value="a" />
    );
    // The Android picker should be rendered (not the iOS modal or web dropdown)
    expect(toJSON()).toBeTruthy();
    // Find the picker by its selectedValue prop (Android overlay renders a Picker directly)
    const pickers = UNSAFE_getAllByProps({selectedValue: "a"});
    expect(pickers.length).toBeGreaterThan(0);
  });

  it("invokes onChange when Android picker value changes", () => {
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SelectBadge onChange={handleChange} options={options} value="a" />
    );
    const pickers = UNSAFE_getAllByProps({selectedValue: "a"});
    const picker = pickers.find(
      (p: {props?: {onValueChange?: (v: string) => void}}) =>
        typeof p.props?.onValueChange === "function"
    );
    expect(picker).toBeDefined();
    act(() => {
      if (picker) {
        picker.props.onValueChange("b");
      }
    });
    expect(handleChange).toHaveBeenCalledWith("b");
  });

  it("renders with disabled prop on Android", () => {
    const {UNSAFE_getAllByProps} = renderWithTheme(
      <SelectBadge disabled onChange={() => {}} options={options} value="a" />
    );
    const pickers = UNSAFE_getAllByProps({enabled: false});
    expect(pickers.length).toBeGreaterThan(0);
  });
});
