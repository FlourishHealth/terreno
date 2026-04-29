import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {Platform} from "react-native";

import {SelectBadge} from "./SelectBadge";
import {renderWithTheme} from "./test-utils";

// Force Platform.OS to "web" for this file so SelectBadge takes the web
// rendering branch (custom WebDropdownMenu instead of the native iOS Picker).
const originalOS = Platform.OS;
beforeAll(() => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: "web"});
});
afterAll(() => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: originalOS});
});

describe("SelectBadge (web)", () => {
  const options = [
    {label: "Option A", value: "a"},
    {label: "Option B", value: "b"},
    {label: "Option C", value: "c"},
  ];

  it("renders the styled web dropdown menu (not the native picker) when opened", () => {
    const {getByLabelText, getByTestId} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={options} value="a" />
    );
    expect(getByTestId("web_badge_modal").props.visible).toBe(false);
    act(() => {
      fireEvent.press(getByLabelText("Open select badge options"));
    });
    expect(getByTestId("web_badge_modal").props.visible).toBe(true);
    expect(getByTestId("web_badge_menu")).toBeTruthy();
  });

  it("invokes onChange with the selected value when an option is pressed", () => {
    const handleChange = mock((_val: string) => {});
    const {getByLabelText, getByTestId} = renderWithTheme(
      <SelectBadge onChange={handleChange} options={options} value="a" />
    );
    act(() => {
      fireEvent.press(getByLabelText("Open select badge options"));
    });
    act(() => {
      fireEvent.press(getByTestId("web_badge_option_b"));
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("b");
  });

  it("closes the menu when the backdrop is pressed", () => {
    const {getByLabelText, getByTestId} = renderWithTheme(
      <SelectBadge onChange={() => {}} options={options} value="a" />
    );
    act(() => {
      fireEvent.press(getByLabelText("Open select badge options"));
    });
    expect(getByTestId("web_badge_modal").props.visible).toBe(true);
    act(() => {
      fireEvent.press(getByTestId("web_badge_backdrop"));
    });
    expect(getByTestId("web_badge_modal").props.visible).toBe(false);
  });

  it("does not open the dropdown when disabled", () => {
    const {getByLabelText, getByTestId} = renderWithTheme(
      <SelectBadge disabled onChange={() => {}} options={options} value="a" />
    );
    act(() => {
      fireEvent.press(getByLabelText("Open select badge options"));
    });
    expect(getByTestId("web_badge_modal").props.visible).toBe(false);
  });
});
