import {afterAll, afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

// Mock isNative to return false so the desktop/web path is rendered
mock.module("./Utilities", () => ({
  isNative: () => false,
}));

import {HeightField} from "./HeightField";
import {renderWithTheme} from "./test-utils";

describe("HeightField (desktop/web path)", () => {
  let mockOnChange: ReturnType<typeof mock>;

  beforeEach(() => {
    mockOnChange = mock(() => {});
  });

  afterEach(() => {});

  afterAll(() => {
    // Restore isNative to default native behavior so the mock doesn't leak to other test files
    mock.module("./Utilities", () => ({
      isNative: () => true,
    }));
  });

  describe("rendering", () => {
    it("renders two text inputs for feet and inches", () => {
      const {getAllByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(getAllByLabelText("ft input").length).toBe(1);
      expect(getAllByLabelText("in input").length).toBe(1);
    });

    it("renders the correct initial feet and inches from value", () => {
      const {getByDisplayValue} = renderWithTheme(
        <HeightField onChange={mockOnChange} value="70" />
      );
      // 70 inches = 5ft 10in
      expect(getByDisplayValue("5")).toBeTruthy();
      expect(getByDisplayValue("10")).toBeTruthy();
    });

    it("renders title when provided", () => {
      const {getByText} = renderWithTheme(
        <HeightField onChange={mockOnChange} title="Height" value="" />
      );
      expect(getByText("Height")).toBeTruthy();
    });

    it("renders helper text", () => {
      const {getByText} = renderWithTheme(
        <HeightField helperText="Enter your height" onChange={mockOnChange} value="" />
      );
      expect(getByText("Enter your height")).toBeTruthy();
    });

    it("renders error text", () => {
      const {getByText} = renderWithTheme(
        <HeightField errorText="Invalid height" onChange={mockOnChange} value="" />
      );
      expect(getByText("Invalid height")).toBeTruthy();
    });
  });

  describe("onChange behavior", () => {
    it("calls onChange with correct total inches when feet changes", () => {
      const {getAllByLabelText} = renderWithTheme(
        <HeightField onChange={mockOnChange} value="70" />
      );
      const feetInput = getAllByLabelText("ft input")[0];
      fireEvent.changeText(feetInput, "6");
      // 6 feet + 10 inches (from value "70" = 5ft 10in, inches = 10) = 82 inches
      expect(mockOnChange).toHaveBeenCalledWith("82");
    });

    it("calls onChange with correct total inches when inches changes", () => {
      const {getAllByLabelText} = renderWithTheme(
        <HeightField onChange={mockOnChange} value="70" />
      );
      const inchesInput = getAllByLabelText("in input")[0];
      fireEvent.changeText(inchesInput, "0");
      // 5 feet (from value "70" = 5ft 10in, feet = 5) + 0 inches = 60 inches
      expect(mockOnChange).toHaveBeenCalledWith("60");
    });

    it("calls onChange with empty string when both inputs are cleared", () => {
      const {getAllByLabelText} = renderWithTheme(
        <HeightField onChange={mockOnChange} value="70" />
      );
      const feetInput = getAllByLabelText("ft input")[0];
      const inchesInput = getAllByLabelText("in input")[0];
      fireEvent.changeText(feetInput, "");
      fireEvent.changeText(inchesInput, "");
      expect(mockOnChange).toHaveBeenCalledWith("");
    });

    it("does not call onChange with values exceeding max feet", () => {
      const {getAllByLabelText} = renderWithTheme(
        <HeightField max={95} onChange={mockOnChange} value="" />
      );
      const feetInput = getAllByLabelText("ft input")[0];
      // max is 95 inches = 7ft 11in, so maxFeet = 7
      fireEvent.changeText(feetInput, "8");
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe("disabled state", () => {
    it("renders text inputs as non-editable when disabled", () => {
      const {getAllByLabelText} = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="70" />
      );
      const feetInput = getAllByLabelText("ft input")[0];
      expect(feetInput.props.editable).toBe(false);
    });
  });

  describe("snapshots", () => {
    it("matches snapshot with default props", () => {
      const component = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("matches snapshot with value", () => {
      const component = renderWithTheme(<HeightField onChange={mockOnChange} value="70" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("matches snapshot when disabled", () => {
      const component = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="70" />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
