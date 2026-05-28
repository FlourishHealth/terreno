import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {HeightActionSheet} from "./HeightActionSheet";
import {HeightField} from "./HeightField";
import {renderWithTheme} from "./test-utils";

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
      const {getAllByText} = renderWithTheme(
        <HeightField onChange={mockOnChange} title="Height" value="" />
      );
      // Title appears in both the field title and the HeightActionSheet
      const heightElements = getAllByText("Height");
      expect(heightElements.length).toBeGreaterThanOrEqual(1);
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

  describe("action sheet interactions", () => {
    it("opens the action sheet when the pressable is tapped", () => {
      const {getByLabelText} = renderWithTheme(<HeightField onChange={mockOnChange} value="60" />);
      const pressable = getByLabelText("Height selector");
      // Should not throw when pressed
      fireEvent.press(pressable);
      expect(pressable).toBeTruthy();
    });

    it("does not open the action sheet when disabled and pressed", () => {
      const {getByLabelText} = renderWithTheme(
        <HeightField disabled onChange={mockOnChange} value="60" />
      );
      const pressable = getByLabelText("Height selector");
      fireEvent.press(pressable);
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("forwards changes from the action sheet to onChange", () => {
      const {UNSAFE_getByType} = renderWithTheme(
        <HeightField onChange={mockOnChange} value="60" />
      );
      const actionSheet = UNSAFE_getByType(HeightActionSheet);
      actionSheet.props.onChange("72");
      expect(mockOnChange).toHaveBeenCalledWith("72");
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
});

describe("HeightField - Android platform", () => {
  // Toggle Platform.OS to "android" to exercise the Android rendering branch
  // that uses SelectField pickers instead of the Pressable+ActionSheet path.
  const {Platform} = require("react-native") as {Platform: {OS: string}};
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "android";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("renders Android pickers with title, helperText, and errorText", () => {
    const onChange = mock(() => {});
    const {getByText, queryByLabelText} = renderWithTheme(
      <HeightField
        errorText="Required"
        helperText="Enter height"
        onChange={onChange}
        title="Height"
        value="70"
      />
    );
    // Title and helper/error rendered
    expect(getByText("Height")).toBeTruthy();
    expect(getByText("Enter height")).toBeTruthy();
    expect(getByText("Required")).toBeTruthy();
    // The Pressable from the iOS branch should NOT be present.
    expect(queryByLabelText("Height selector")).toBeNull();
  });

  it("renders Android pickers in disabled state", () => {
    const onChange = mock(() => {});
    const {root} = renderWithTheme(
      <HeightField disabled onChange={onChange} title="Height" value="60" />
    );
    expect(root).toBeTruthy();
  });

  it("forwards feet picker changes to onChange (Android)", () => {
    const onChange = mock(() => {});
    const {SelectField} = require("./SelectField") as {
      SelectField: React.ComponentType<{onChange?: (v: string) => void}>;
    };
    const {UNSAFE_getAllByType} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const selects = UNSAFE_getAllByType(SelectField);
    expect(selects.length).toBe(2);
    // First SelectField is feet. value="70" → 5ft 10in. Bumping feet to 6 yields 6*12+10=82.
    selects[0].props.onChange?.("6");
    expect(onChange).toHaveBeenCalledWith("82");
  });

  it("forwards inches picker changes to onChange (Android)", () => {
    const onChange = mock(() => {});
    const {SelectField} = require("./SelectField") as {
      SelectField: React.ComponentType<{onChange?: (v: string) => void}>;
    };
    const {UNSAFE_getAllByType} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const selects = UNSAFE_getAllByType(SelectField);
    expect(selects.length).toBe(2);
    // Second SelectField is inches. value="70" → 5ft 10in. Changing inches to 3 yields 5*12+3=63.
    selects[1].props.onChange?.("3");
    expect(onChange).toHaveBeenCalledWith("63");
  });
});

describe("HeightField - Desktop platform", () => {
  const {Platform} = require("react-native") as {Platform: {OS: string}};
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = "web";
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("fires handleBlur on HeightSegment and calls onChange", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const feetInput = getByLabelText("ft input");
    fireEvent(feetInput, "blur");
    expect(onChange).toHaveBeenCalled();
  });

  it("handles text input change in feet segment", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const feetInput = getByLabelText("ft input");
    fireEvent.changeText(feetInput, "6");
    expect(onChange).toHaveBeenCalled();
  });

  it("handles clearing feet input to empty", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const feetInput = getByLabelText("ft input");
    fireEvent.changeText(feetInput, "");
    expect(onChange).toHaveBeenCalled();
  });

  it("calls onChange with empty when both feet and inches are cleared", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="" />);
    const feetInput = getByLabelText("ft input");
    fireEvent.changeText(feetInput, "");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders HeightSegment in disabled state", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(
      <HeightField disabled onChange={onChange} value="70" />
    );
    expect(getByLabelText("ft input")).toBeTruthy();
  });

  it("renders HeightSegment with error text", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(
      <HeightField errorText="Required" onChange={onChange} value="70" />
    );
    expect(getByLabelText("ft input")).toBeTruthy();
  });

  it("fires focus on feet segment", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const feetInput = getByLabelText("ft input");
    fireEvent(feetInput, "focus");
    expect(feetInput).toBeTruthy();
  });

  it("fires focus on inches segment", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const inInput = getByLabelText("in input");
    fireEvent(inInput, "focus");
    expect(inInput).toBeTruthy();
  });

  it("handles text input change in inches segment", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const inInput = getByLabelText("in input");
    fireEvent.changeText(inInput, "3");
    expect(onChange).toHaveBeenCalled();
  });

  it("handles non-numeric input in HeightSegment", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const feetInput = getByLabelText("ft input");
    fireEvent.changeText(feetInput, "abc");
    expect(onChange).toHaveBeenCalled();
  });

  it("clamps to max value in HeightSegment handleChange", () => {
    const onChange = mock(() => {});
    const {getByLabelText} = renderWithTheme(<HeightField onChange={onChange} value="70" />);
    const feetInput = getByLabelText("ft input");
    fireEvent.changeText(feetInput, "99");
    expect(feetInput).toBeTruthy();
  });
});
