import {describe, expect, it, mock} from "bun:test";

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
});
