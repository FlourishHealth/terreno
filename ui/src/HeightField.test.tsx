import {afterEach, beforeEach, describe, expect, it, mock, spyOn} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";

import {HeightField} from "./HeightField";
import * as MediaQuery from "./MediaQuery";
import {renderWithTheme} from "./test-utils";
import * as Utilities from "./Utilities";

describe("HeightField", () => {
  let mockOnChange: ReturnType<typeof mock>;

  beforeEach(() => {
    mockOnChange = mock(() => {});
  });

  afterEach(() => {
    // Reset mocks after each test
  });

  describe("basic rendering", () => {
    it("should render with default props", () => {
      const {root} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(root).toBeTruthy();
    });

    it("should render with title", () => {
      const {getByText} = renderWithTheme(
        <HeightField onChange={mockOnChange} title="Height" value="" />
      );
      expect(getByText("Height")).toBeTruthy();
    });

    it("should render helper text", () => {
      const {getByText} = renderWithTheme(
        <HeightField helperText="Enter your height" onChange={mockOnChange} value="" />
      );
      expect(getByText("Enter your height")).toBeTruthy();
    });

    it("should render error text", () => {
      const {getByText} = renderWithTheme(
        <HeightField errorText="Height is required" onChange={mockOnChange} value="" />
      );
      expect(getByText("Height is required")).toBeTruthy();
    });

    it("should render placeholder text when no value", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(getByText("Select height")).toBeTruthy();
    });
  });

  describe("value display (mobile mode)", () => {
    it("should display formatted height for 70 inches (5ft 10in)", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="70" />);
      expect(getByText("5ft 10in")).toBeTruthy();
    });

    it("should display formatted height for 72 inches (6ft 0in)", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="72" />);
      expect(getByText("6ft 0in")).toBeTruthy();
    });

    it("should display formatted height for 60 inches (5ft 0in)", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="60" />);
      expect(getByText("5ft 0in")).toBeTruthy();
    });

    it("should handle empty value", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(getByText("Select height")).toBeTruthy();
    });

    it("should handle undefined value", () => {
      const {getByText} = renderWithTheme(
        <HeightField onChange={mockOnChange} value={undefined} />
      );
      expect(getByText("Select height")).toBeTruthy();
    });

    it("should display formatted height for 0 inches (0ft 0in)", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="0" />);
      expect(getByText("0ft 0in")).toBeTruthy();
    });

    it("should display formatted height for 95 inches (7ft 11in)", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="95" />);
      expect(getByText("7ft 11in")).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("should have correct accessibility properties on pressable", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const pressable = getByLabelText("Height selector");
      expect(pressable).toBeTruthy();
      expect(pressable.props.accessibilityHint).toBe("Tap to select height");
    });
  });

  describe("disabled state", () => {
    it("should render in disabled state", () => {
      const {root} = renderWithTheme(<HeightField disabled onChange={mockOnChange} value="70" />);
      expect(root).toBeTruthy();
    });

    it("should display value when disabled", () => {
      const {getByText} = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="70" />
      );
      expect(getByText("5ft 10in")).toBeTruthy();
    });

    it("should have disabled prop on pressable when disabled", () => {
      const {getByLabelText} = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="70" />
      );
      const pressable = getByLabelText("Height selector");
      expect(pressable.props.disabled).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle non-numeric value gracefully", () => {
      const {root} = renderWithTheme(<HeightField onChange={mockOnChange} value="abc" />);
      expect(root).toBeTruthy();
    });

    it("should render without crashing for invalid value", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="abc" />);
      const pressable = getByLabelText("Height selector");
      expect(pressable).toBeTruthy();
    });

    it("should show placeholder text for invalid non-numeric value", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="abc" />);
      expect(getByText("Select height")).toBeTruthy();
    });

    it("should show placeholder text for value that formats to empty string", () => {
      const {getByText} = renderWithTheme(<HeightField onChange={mockOnChange} value="xyz123abc" />);
      expect(getByText("Select height")).toBeTruthy();
    });
  });

  describe("snapshots", () => {
    it("should match snapshot with default props", () => {
      const component = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with value", () => {
      const component = renderWithTheme(<HeightField onChange={mockOnChange} value="70" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with all props", () => {
      const component = renderWithTheme(
        <HeightField
          disabled={false}
          errorText="Error text"
          helperText="Helper text"
          onChange={mockOnChange}
          title="Height"
          value="70"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot when disabled", () => {
      const component = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} title="Height" value="70" />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with error state", () => {
      const component = renderWithTheme(
        <HeightField
          errorText="Height is required"
          onChange={mockOnChange}
          title="Height"
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });
  });

  describe("desktop mode (two TextInput fields)", () => {
    let isNativeSpy: ReturnType<typeof spyOn>;
    let isMobileDeviceSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      isNativeSpy = spyOn(Utilities, "isNative").mockReturnValue(false);
      isMobileDeviceSpy = spyOn(MediaQuery, "isMobileDevice").mockReturnValue(false);
    });

    afterEach(() => {
      isNativeSpy.mockRestore();
      isMobileDeviceSpy.mockRestore();
    });

    it("should render two TextInput fields for feet and inches", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      expect(getByLabelText("ft input")).toBeTruthy();
      expect(getByLabelText("in input")).toBeTruthy();
    });

    it("should display feet and inches separately for 70 inches (5ft 10in)", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="70" />);
      const feetInput = getByLabelText("ft input");
      const inchesInput = getByLabelText("in input");
      expect(feetInput.props.value).toBe("5");
      expect(inchesInput.props.value).toBe("10");
    });

    it("should display feet and inches separately for 72 inches (6ft 0in)", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="72" />);
      const feetInput = getByLabelText("ft input");
      const inchesInput = getByLabelText("in input");
      expect(feetInput.props.value).toBe("6");
      expect(inchesInput.props.value).toBe("0");
    });

    it("should call onChange when feet value changes", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="60" />);
      const feetInput = getByLabelText("ft input");

      await act(async () => {
        fireEvent.changeText(feetInput, "6");
      });

      await act(async () => {
        fireEvent(feetInput, "blur");
      });

      expect(mockOnChange).toHaveBeenCalledWith("72");
    });

    it("should call onChange when inches value changes", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="60" />);
      const inchesInput = getByLabelText("in input");

      await act(async () => {
        fireEvent.changeText(inchesInput, "6");
      });

      await act(async () => {
        fireEvent(inchesInput, "blur");
      });

      expect(mockOnChange).toHaveBeenCalledWith("66");
    });

    it("should filter non-numeric input in feet field", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const feetInput = getByLabelText("ft input");

      await act(async () => {
        fireEvent.changeText(feetInput, "5abc");
      });

      expect(feetInput.props.value).toBe("5");
    });

    it("should filter non-numeric input in inches field", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const inchesInput = getByLabelText("in input");

      await act(async () => {
        fireEvent.changeText(inchesInput, "10xyz");
      });

      expect(inchesInput.props.value).toBe("10");
    });

    it("should enforce max value of 8 for feet", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const feetInput = getByLabelText("ft input");

      await act(async () => {
        fireEvent.changeText(feetInput, "9");
      });

      expect(feetInput.props.value).toBe("");
    });

    it("should allow max value of 8 for feet", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const feetInput = getByLabelText("ft input");

      await act(async () => {
        fireEvent.changeText(feetInput, "8");
      });

      expect(feetInput.props.value).toBe("8");
    });

    it("should enforce max value of 11 for inches", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const inchesInput = getByLabelText("in input");

      await act(async () => {
        fireEvent.changeText(inchesInput, "12");
      });

      expect(inchesInput.props.value).toBe("");
    });

    it("should render with disabled state", () => {
      const {getByLabelText} = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="70" />
      );
      const feetInput = getByLabelText("ft input");
      const inchesInput = getByLabelText("in input");
      expect(feetInput.props.readOnly).toBe(true);
      expect(inchesInput.props.readOnly).toBe(true);
    });

    it("should handle empty value", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="" />);
      const feetInput = getByLabelText("ft input");
      const inchesInput = getByLabelText("in input");
      expect(feetInput.props.value).toBe("");
      expect(inchesInput.props.value).toBe("");
    });

    it("should call onChange with empty string when both fields are cleared", async () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="70" />);
      const feetInput = getByLabelText("ft input");
      const inchesInput = getByLabelText("in input");

      await act(async () => {
        fireEvent.changeText(feetInput, "");
      });

      await act(async () => {
        fireEvent.changeText(inchesInput, "");
      });

      await act(async () => {
        fireEvent(inchesInput, "blur");
      });

      expect(mockOnChange).toHaveBeenCalledWith("");
    });

    it("should match snapshot in desktop mode", () => {
      const component = renderWithTheme(<HeightField onChange={mockOnChange} value="70" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot in desktop mode with error", () => {
      const component = renderWithTheme(
        <HeightField errorText="Height is required" onChange={mockOnChange} value="" />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot in desktop mode when disabled", () => {
      const component = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="70" />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
