import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {Platform} from "react-native";

import {RNPickerSelect} from "./PickerSelect";
import {renderWithTheme} from "./test-utils";

// Force Platform.OS to "android" for this file so RNPickerSelect takes the
// custom bottom-sheet path instead of the iOS picker modal.
const originalOS = Platform.OS;
beforeAll(() => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: "android"});
});
afterAll(() => {
  Object.defineProperty(Platform, "OS", {configurable: true, value: originalOS});
});

describe("PickerSelect (android)", () => {
  const defaultProps = {
    items: [
      {label: "Option 1", value: "1"},
      {label: "Option 2", value: "2"},
      {label: "Option 3", value: "3"},
    ],
    onValueChange: () => {},
    placeholder: {label: "Select an option", value: ""},
  };

  it("opens the Android modal when the trigger is pressed", () => {
    const onOpen = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onOpen={onOpen} value="1" />
    );

    expect(getByTestId("android_modal").props.visible).toBe(false);

    act(() => {
      fireEvent.press(getByTestId("android_touchable_wrapper"));
    });

    expect(getByTestId("android_modal").props.visible).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("closes without changing value when Cancel is pressed", () => {
    const onValueChange = mock(() => {});
    const onClose = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onClose={onClose} onValueChange={onValueChange} value="1" />
    );

    act(() => {
      fireEvent.press(getByTestId("android_touchable_wrapper"));
    });
    act(() => {
      fireEvent.press(getByTestId("cancel_button"));
    });

    expect(getByTestId("android_modal").props.visible).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes without changing value when the backdrop is pressed", () => {
    const onValueChange = mock(() => {});
    const onClose = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onClose={onClose} onValueChange={onValueChange} value="1" />
    );

    act(() => {
      fireEvent.press(getByTestId("android_touchable_wrapper"));
    });
    act(() => {
      fireEvent.press(getByTestId("android_modal_backdrop"));
    });

    expect(getByTestId("android_modal").props.visible).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onValueChange and closes when an option is selected", () => {
    const onValueChange = mock(() => {});
    const onClose = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onClose={onClose} onValueChange={onValueChange} value="1" />
    );

    act(() => {
      fireEvent.press(getByTestId("android_touchable_wrapper"));
    });
    // options = [placeholder, item0, item1, item2] -> Option 2 is index 2
    act(() => {
      fireEvent.press(getByTestId("android_picker_option_2"));
    });

    expect(onValueChange).toHaveBeenCalledWith("2", 2);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(getByTestId("android_modal").props.visible).toBe(false);
  });

  it("closes when onRequestClose is invoked (hardware back)", () => {
    const onClose = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onClose={onClose} value="1" />
    );

    act(() => {
      fireEvent.press(getByTestId("android_touchable_wrapper"));
    });
    act(() => {
      getByTestId("android_modal").props.onRequestClose?.();
    });

    expect(getByTestId("android_modal").props.visible).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not open the modal when disabled", () => {
    const onOpen = mock(() => {});
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps} disabled onOpen={onOpen} value="1" />
    );

    act(() => {
      fireEvent.press(getByTestId("android_touchable_wrapper"));
    });

    expect(getByTestId("android_modal").props.visible).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
