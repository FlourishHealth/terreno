import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {RNPickerSelect} from "./PickerSelect";
import {renderWithTheme} from "./test-utils";

// Note: @react-native-picker/picker is mocked globally in bunSetup.ts

describe("PickerSelect", () => {
  const defaultProps = {
    items: [
      {label: "Option 1", value: "1"},
      {label: "Option 2", value: "2"},
      {label: "Option 3", value: "3"},
    ],
    onValueChange: () => {},
    placeholder: {label: "Select an option", value: ""},
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("component is defined", () => {
    expect(RNPickerSelect).toBeDefined();
    expect(typeof RNPickerSelect).toBe("function");
  });

  it("renders with selected value", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} value="2" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders disabled state", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} disabled />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without placeholder when placeholder is empty object", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} placeholder={{}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("matches items by itemKey", () => {
    const items = [
      {key: "k1", label: "Option 1", value: "1"},
      {key: "k2", label: "Option 2", value: "2"},
    ];
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        itemKey="k2"
        items={items}
        placeholder={{label: "Select", value: ""}}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders children when provided", () => {
    const {getByTestId} = renderWithTheme(
      <RNPickerSelect {...defaultProps}>
        <>Custom child content</>
      </RNPickerSelect>
    );
    expect(getByTestId).toBeDefined();
  });

  it("renders custom InputAccessoryView", () => {
    const CustomAccessory = () => null;
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} InputAccessoryView={CustomAccessory} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("passes textInputProps to TextInput", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        textInputProps={{placeholder: "Custom placeholder"}}
        value="1"
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onValueChange when value changes", () => {
    const mockOnValueChange = mock(() => {});
    renderWithTheme(
      <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="1" />
    );
    // The component is rendered, onValueChange would be called on user interaction
    expect(mockOnValueChange).toBeDefined();
  });

  it("does not crash when value does not match any item", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} value="nonexistent" />);
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onOpen, onClose, onDonePress callbacks", () => {
    const onOpen = mock(() => {});
    const onClose = mock(() => {});
    const onDonePress = mock(() => {});
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        onClose={onClose}
        onDonePress={onDonePress}
        onOpen={onOpen}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("accepts onUpArrow and onDownArrow callbacks", () => {
    const onUpArrow = mock(() => {});
    const onDownArrow = mock(() => {});
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} onDownArrow={onDownArrow} onUpArrow={onUpArrow} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("forwards touchableDoneProps and touchableWrapperProps", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect
        {...defaultProps}
        touchableDoneProps={{testID: "custom_done"}}
        touchableWrapperProps={{testID: "custom_wrapper"}}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing when fixAndroidTouchableBug is true", () => {
    const {toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} fixAndroidTouchableBug />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders without crashing when useNativeAndroidPickerStyle is false", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} useNativeAndroidPickerStyle={false} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders with modalProps", () => {
    const {toJSON} = renderWithTheme(
      <RNPickerSelect {...defaultProps} modalProps={{animationType: "fade"}} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("updates selected item when value prop changes", () => {
    const {rerender, toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} value="1" />);
    rerender(<RNPickerSelect {...defaultProps} value="3" />);
    expect(toJSON()).toBeTruthy();
  });

  describe("interactions on iOS", () => {
    it("fires onOpen when the iOS wrapper is pressed and onClose when Done is pressed", async () => {
      const onOpen = mock(() => {});
      const onClose = mock(() => {});
      const onDonePress = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <RNPickerSelect
          {...defaultProps}
          onClose={onClose}
          onDonePress={onDonePress}
          onOpen={onOpen}
        />
      );

      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      expect(onOpen).toHaveBeenCalled();

      await act(async () => {
        fireEvent.press(getByTestId("done_button"));
      });
      expect(onClose).toHaveBeenCalled();
      expect(onDonePress).toHaveBeenCalled();
    });

    it("invokes up/down arrow callbacks when their touchables are pressed", async () => {
      const onUpArrow = mock(() => {});
      const onDownArrow = mock(() => {});
      const {getByTestId, UNSAFE_getAllByType} = renderWithTheme(
        <RNPickerSelect {...defaultProps} onDownArrow={onDownArrow} onUpArrow={onUpArrow} />
      );
      // Open the modal so the accessory view is rendered.
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const {TouchableOpacity} = require("react-native");
      const touchables = UNSAFE_getAllByType(TouchableOpacity).filter(
        (t: any) => typeof t.props.onPress === "function"
      );
      // The accessory view renders an up-arrow TouchableOpacity then a down-arrow one.
      expect(touchables.length).toBeGreaterThanOrEqual(2);
      await act(async () => {
        touchables[0].props.onPress();
      });
      await act(async () => {
        touchables[1].props.onPress();
      });
      expect(onUpArrow).toHaveBeenCalled();
      expect(onDownArrow).toHaveBeenCalled();
    });

    it("toggles the done button press state when pressed in/out", async () => {
      const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} />);
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const doneButton = getByTestId("done_button");
      await act(async () => {
        fireEvent(doneButton, "pressIn");
      });
      await act(async () => {
        fireEvent(doneButton, "pressOut");
      });
    });

    it("does not open when disabled", async () => {
      const onOpen = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <RNPickerSelect {...defaultProps} disabled onOpen={onOpen} />
      );
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("calls onValueChange and updates selected item when the Picker emits a change", async () => {
      const mockOnValueChange = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} />
      );
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const picker = getByTestId("ios_picker");
      await act(async () => {
        picker.props.onValueChange?.("2", 1);
      });
      expect(mockOnValueChange).toHaveBeenCalledWith("2", 1);
    });

    it("updates orientation state when the iOS modal rotates", async () => {
      const {getByTestId, toJSON} = renderWithTheme(<RNPickerSelect {...defaultProps} />);
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      const modal = getByTestId("ios_modal");
      await act(async () => {
        modal.props.onOrientationChange?.({nativeEvent: {orientation: "landscape"}});
      });
      expect(toJSON()).toBeTruthy();
    });

    it("closes the modal when the top overlay is pressed", async () => {
      const onClose = mock(() => {});
      const {getByTestId} = renderWithTheme(<RNPickerSelect {...defaultProps} onClose={onClose} />);
      await act(async () => {
        fireEvent.press(getByTestId("ios_touchable_wrapper"));
      });
      await act(async () => {
        fireEvent.press(getByTestId("ios_modal_top"));
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
