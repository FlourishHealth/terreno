import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
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
