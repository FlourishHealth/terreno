import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {userEvent} from "@testing-library/react-native";

import {TextArea} from "./TextArea";
import {renderWithTheme} from "./test-utils";

describe("TextArea", () => {
  let mockOnChange: ReturnType<typeof mock>;

  beforeEach(() => {
    mockOnChange = mock(() => {});
  });

  afterEach(() => {
    // Reset mocks after each test
  });

  describe("basic functionality", () => {
    it("should render as multiline text field", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextArea onChange={mockOnChange} value="test content" />
      );

      const input = getByDisplayValue("test content");
      expect(input.props.multiline).toBe(true);
      expect(input.props.value).toBe("test content");
    });

    it("should render with title", () => {
      const {getByText} = renderWithTheme(
        <TextArea onChange={mockOnChange} title="Description" value="" />
      );

      expect(getByText("Description")).toBeTruthy();
    });

    it("should render with placeholder", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <TextArea onChange={mockOnChange} placeholder="Enter description" value="" />
      );

      expect(getByPlaceholderText("Enter description")).toBeTruthy();
    });

    it("should render helper text", () => {
      const {getByText} = renderWithTheme(
        <TextArea helperText="Maximum 500 characters" onChange={mockOnChange} value="" />
      );

      expect(getByText("Maximum 500 characters")).toBeTruthy();
    });

    it("should render error text", () => {
      const {getByText} = renderWithTheme(
        <TextArea errorText="This field is required" onChange={mockOnChange} value="" />
      );

      expect(getByText("This field is required")).toBeTruthy();
    });

    it("should support grow behavior", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextArea grow onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.multiline).toBe(true);
    });

    it("should be disabled when disabled prop is true", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextArea disabled onChange={mockOnChange} value="test" />
      );

      const input = getByDisplayValue("test");
      expect(input.props.readOnly).toBe(true);
    });

    it("should always have text type", () => {
      const {getByDisplayValue} = renderWithTheme(<TextArea onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      expect(input.props.keyboardType).toBe("default");
    });
  });

  describe("user interactions", () => {
    it("should call onChange when text is entered", async () => {
      const user = userEvent.setup();
      const {getByDisplayValue} = renderWithTheme(<TextArea onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      await user.type(input, "hello world");

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange.mock.calls.length).toBeGreaterThan(0);
    });

    it("should handle multiline text input", async () => {
      const user = userEvent.setup();
      const multilineText = "Line 1\nLine 2\nLine 3";
      const {getByDisplayValue} = renderWithTheme(<TextArea onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      await user.type(input, multilineText);

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe("accessibility", () => {
    it("should have correct accessibility properties", () => {
      const {getByDisplayValue} = renderWithTheme(<TextArea onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      expect(input.props.accessibilityHint).toBe("Enter text here");
      expect(input.props["aria-label"]).toBe("Text input field");
    });

    it("should indicate disabled state in accessibility", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextArea disabled onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty value", () => {
      const {getByDisplayValue} = renderWithTheme(<TextArea onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      expect(input.props.value).toBe("");
    });

    it("should handle undefined value", () => {
      const {root} = renderWithTheme(<TextArea onChange={mockOnChange} value={undefined} />);

      expect(root).toBeTruthy();
    });

    it("should handle long text values", () => {
      const longText = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(50);
      const {getByDisplayValue} = renderWithTheme(
        <TextArea onChange={mockOnChange} value={longText} />
      );

      const input = getByDisplayValue(longText);
      expect(input.props.value).toBe(longText);
    });

    it("should handle text with line breaks", () => {
      const textWithBreaks = "First line\nSecond line\n\nFourth line";
      const {getByDisplayValue} = renderWithTheme(
        <TextArea onChange={mockOnChange} value={textWithBreaks} />
      );

      const input = getByDisplayValue(textWithBreaks);
      expect(input.props.value).toBe(textWithBreaks);
    });
  });

  describe("props inheritance", () => {
    it("should inherit all TextField props except multiline and type", () => {
      const mockOnFocus = mock(() => {});
      const mockOnBlur = mock(() => {});

      const {getByDisplayValue} = renderWithTheme(
        <TextArea
          disabled={false}
          onBlur={mockOnBlur}
          onChange={mockOnChange}
          onFocus={mockOnFocus}
          placeholder="Test placeholder"
          rows={5}
          value="test"
        />
      );

      const input = getByDisplayValue("test");
      expect(input.props.numberOfLines).toBe(5);
      expect(input.props.onFocus).toBeTruthy();
      expect(input.props.onBlur).toBeTruthy();
    });

    it("should support inputRef", () => {
      const mockInputRef = mock(() => {});
      renderWithTheme(<TextArea inputRef={mockInputRef} onChange={mockOnChange} value="" />);

      expect(mockInputRef).toHaveBeenCalled();
    });
  });

  describe("snapshots", () => {
    it("should match snapshot with default props", () => {
      const component = renderWithTheme(<TextArea onChange={mockOnChange} value="test content" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with all props", () => {
      const component = renderWithTheme(
        <TextArea
          disabled={false}
          grow={true}
          helperText="Maximum 500 characters"
          onChange={mockOnChange}
          placeholder="Enter description"
          rows={5}
          title="Description"
          value="test content"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot when disabled", () => {
      const component = renderWithTheme(
        <TextArea
          disabled={true}
          onChange={mockOnChange}
          title="Disabled TextArea"
          value="disabled content"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with error state", () => {
      const component = renderWithTheme(
        <TextArea
          errorText="This field is required"
          onChange={mockOnChange}
          title="Error TextArea"
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with multiline content", () => {
      const component = renderWithTheme(
        <TextArea
          onChange={mockOnChange}
          rows={4}
          title="Multiline Content"
          value="Line 1\nLine 2\nLine 3"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
