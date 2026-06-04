import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {Platform, TouchableOpacity} from "react-native";

import {SelectBadge} from "./SelectBadge";
import {renderWithTheme} from "./test-utils";

// Force Platform.OS to "android" for this file so SelectBadge uses the modal picker.
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

  it("renders the badge with the modal picker closed initially", () => {
    const {toJSON, UNSAFE_getAllByProps} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={options} value="a" />
    );
    expect(toJSON()).toBeTruthy();
    const modals = UNSAFE_getAllByProps({visible: false});
    expect(modals.length).toBeGreaterThan(0);
  });

  it("opens modal picker and invokes onChange when Save is pressed", async () => {
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByProps, UNSAFE_getAllByType} = renderWithTheme(
      <SelectBadge onChange={handleChange} options={options} value="a" />
    );

    const openButtons = UNSAFE_getAllByType(TouchableOpacity).filter(
      (t: {props?: {accessibilityLabel?: string}}) =>
        t.props?.accessibilityLabel === "Open select badge options"
    );
    expect(openButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.press(openButtons[0]);
    });

    const pickers = UNSAFE_getAllByProps({selectedValue: "a"});
    const picker = pickers.find(
      (p: {props?: {onValueChange?: (v: string) => void}}) =>
        typeof p.props?.onValueChange === "function"
    );
    expect(picker).toBeDefined();

    await act(async () => {
      if (picker) {
        picker.props.onValueChange("b");
      }
    });

    const saveButtons = UNSAFE_getAllByType(TouchableOpacity).filter(
      (t: {props?: {accessibilityLabel?: string}}) =>
        t.props?.accessibilityLabel === "Save selected value"
    );
    expect(saveButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.press(saveButtons[0]);
    });

    expect(handleChange).toHaveBeenCalledWith("b");
  });

  it("dismisses modal picker via backdrop without calling onChange", async () => {
    const handleChange = mock((_val: string) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <SelectBadge onChange={handleChange} options={options} value="a" />
    );

    const openButtons = UNSAFE_getAllByType(TouchableOpacity).filter(
      (t: {props?: {accessibilityLabel?: string}}) =>
        t.props?.accessibilityLabel === "Open select badge options"
    );

    await act(async () => {
      fireEvent.press(openButtons[0]);
    });

    const dismissButtons = UNSAFE_getAllByType(TouchableOpacity).filter(
      (t: {props?: {accessibilityLabel?: string}}) =>
        t.props?.accessibilityLabel === "Dismiss picker modal"
    );
    expect(dismissButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.press(dismissButtons[0]);
    });

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("renders with disabled prop on Android", async () => {
    const {UNSAFE_getAllByProps, UNSAFE_getAllByType} = renderWithTheme(
      <SelectBadge disabled onChange={() => {}} options={options} value="a" />
    );

    const openButtons = UNSAFE_getAllByType(TouchableOpacity).filter(
      (t: {props?: {accessibilityLabel?: string; disabled?: boolean}}) =>
        t.props?.accessibilityLabel === "Open select badge options"
    );
    expect(openButtons[0]?.props?.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(openButtons[0]);
    });

    const pickers = UNSAFE_getAllByProps({enabled: false});
    expect(pickers.length).toBeGreaterThan(0);
  });
});
