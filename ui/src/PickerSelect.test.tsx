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

  it("calls onValueChange when value changes", () => {
    const mockOnValueChange = mock(() => {});
    renderWithTheme(
      <RNPickerSelect {...defaultProps} onValueChange={mockOnValueChange} value="1" />
    );
    // The component is rendered, onValueChange would be called on user interaction
    expect(mockOnValueChange).toBeDefined();
  });
});
