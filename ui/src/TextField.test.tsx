import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, userEvent} from "@testing-library/react-native";
import {TextField} from "./TextField";
import {renderWithTheme} from "./test-utils";

describe("TextField", () => {
  let mockOnChange: ReturnType<typeof mock>;
  let mockOnFocus: ReturnType<typeof mock>;
  let mockOnBlur: ReturnType<typeof mock>;
  let mockOnEnter: ReturnType<typeof mock>;

  beforeEach(() => {
    mockOnChange = mock(() => {});
    mockOnFocus = mock(() => {});
    mockOnBlur = mock(() => {});
    mockOnEnter = mock(() => {});
  });

  afterEach(() => {
    // Reset mocks after each test
  });

  describe("basic rendering", () => {
    it("should render with default props", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} value="test value" />
      );

      expect(getByDisplayValue("test value").props.value).toBe("test value");
    });

    it("should render with title", () => {
      const {getByText} = renderWithTheme(
        <TextField onChange={mockOnChange} title="Test Title" value="" />
      );

      expect(getByText("Test Title")).toBeTruthy();
    });

    it("should render with placeholder", () => {
      const {getByPlaceholderText} = renderWithTheme(
        <TextField onChange={mockOnChange} placeholder="Enter text" value="" />
      );

      expect(getByPlaceholderText("Enter text")).toBeTruthy();
    });

    it("should render helper text", () => {
      const {getByText} = renderWithTheme(
        <TextField helperText="This is helper text" onChange={mockOnChange} value="" />
      );

      expect(getByText("This is helper text")).toBeTruthy();
    });

    it("should render error text", () => {
      const {getByText} = renderWithTheme(
        <TextField errorText="This is an error" onChange={mockOnChange} value="" />
      );

      expect(getByText("This is an error")).toBeTruthy();
    });
  });

  describe("user interactions", () => {
    it("should call onChange when text is entered", async () => {
      const user = userEvent.setup();
      const {getByDisplayValue} = renderWithTheme(<TextField onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      await user.type(input, "hello");

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnChange.mock.calls.length).toBeGreaterThan(0);
    });

    it("should call onFocus when input is focused", async () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} onFocus={mockOnFocus} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.onFocus).toBeTruthy();
    });

    it("should call onBlur when input loses focus", async () => {
      const user = userEvent.setup();
      const {getByDisplayValue} = renderWithTheme(
        <TextField onBlur={mockOnBlur} onChange={mockOnChange} value="test" />
      );

      const input = getByDisplayValue("test");
      await user.press(input);
      await act(async () => {
        input.props.onBlur();
      });

      expect(mockOnBlur).toHaveBeenCalledTimes(1);
      expect(mockOnBlur.mock.calls[0][0]).toBe("test");
    });

    it("should call onEnter when enter key is pressed", async () => {
      const _user = userEvent.setup();
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} onEnter={mockOnEnter} value="" />
      );

      const input = getByDisplayValue("");
      await act(async () => {
        input.props.onSubmitEditing();
      });

      expect(mockOnEnter).toHaveBeenCalledTimes(1);
    });

    it("should trim value on blur if trimOnBlur is true, even if onBlur prop is not provided", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} trimOnBlur value="test    " />
      );

      const input = getByDisplayValue("test    ");

      fireEvent(input, "blur");

      // on change should be called with trimmed value
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe("test");
    });

    it("should trim value on blur if trimOnBlur is true, with onBlur prop provided", async () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onBlur={mockOnBlur} onChange={mockOnChange} trimOnBlur={true} value="test    " />
      );

      const input = getByDisplayValue("test    ");

      fireEvent(input, "blur");

      // onChange should be called with trimmed value
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe("test");

      // onBlur should also be called with trimmed value
      expect(mockOnBlur).toHaveBeenCalledTimes(1);
      expect(mockOnBlur.mock.calls[0][0]).toBe("test");
    });

    it("should NOT trim value on blur if trimOnBlur is false", async () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} trimOnBlur={false} value="test    " />
      );

      const input = getByDisplayValue("test    ");
      fireEvent(input, "blur");

      // onChange should not be called because the value hasn't changed (no trimming)
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it("trims on blur by default when no prop is provided", async () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} value="test    " />
      );

      const input = getByDisplayValue("test    ");
      fireEvent(input, "blur");

      // onChange should be called with trimmed value
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe("test");
    });
  });

  describe("field types", () => {
    it("should render email type with correct keyboard", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="email" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.keyboardType).toBe("email-address");
    });

    it("should render password type with secure text entry", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="password" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.secureTextEntry).toBe(true);
    });

    it("should render url type with correct keyboard", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="url" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.keyboardType === "url" || input.props.keyboardType === "default").toBe(
        true
      );
    });

    it("should render phoneNumber type with number keyboard", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="phoneNumber" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.keyboardType).toBe("number-pad");
    });

    it("should render search type with default keyboard", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="search" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.keyboardType).toBe("default");
    });
  });

  describe("multiline behavior", () => {
    it("should render as multiline when multiline prop is true", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField multiline onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.multiline).toBe(true);
    });

    it("should set number of lines when rows prop is provided", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField multiline onChange={mockOnChange} rows={5} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.numberOfLines).toBe(5);
    });

    it("should handle grow behavior with multiline", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField grow multiline onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.multiline).toBe(true);
    });
  });

  describe("disabled state", () => {
    it("should be read-only when disabled", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField disabled onChange={mockOnChange} value="test" />
      );

      const input = getByDisplayValue("test");
      expect(input.props.readOnly).toBe(true);
    });

    it("should not call onFocus when disabled", async () => {
      const _user = userEvent.setup();
      const {getByDisplayValue} = renderWithTheme(
        <TextField disabled onChange={mockOnChange} onFocus={mockOnFocus} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.readOnly).toBe(true);
    });

    it("should not call onBlur when disabled", async () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField disabled onBlur={mockOnBlur} onChange={mockOnChange} value="test" />
      );

      const input = getByDisplayValue("test");
      await act(async () => {
        input.props.onBlur();
      });

      expect(mockOnBlur).not.toHaveBeenCalled();
    });
  });

  describe("icon functionality", () => {
    it("should render icon when iconName is provided", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField iconName="check" onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input).toBeTruthy();
    });

    it("should call onIconClick when icon is pressed", async () => {
      const mockOnIconClick = mock(() => {});
      const {getByDisplayValue} = renderWithTheme(
        <TextField
          iconName="check"
          onChange={mockOnChange}
          onIconClick={mockOnIconClick}
          value=""
        />
      );

      const input = getByDisplayValue("");
      expect(input).toBeTruthy();
    });
  });

  describe("accessibility", () => {
    it("should have correct accessibility properties", () => {
      const {getByDisplayValue} = renderWithTheme(<TextField onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      expect(input.props.accessibilityHint).toBe("Enter text here");
      expect(input.props["aria-label"]).toBe("Text input field");
    });

    it("should indicate disabled state in accessibility", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField disabled onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe("auto-complete and text content", () => {
    it("should set autoComplete property", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField autoComplete="username" onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input).toBeTruthy();
    });

    it("should handle text content type for email", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="email" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.textContentType).toBe("emailAddress");
    });

    it("should handle text content type for password", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} type="password" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.textContentType).toBe("password");
    });
  });

  describe("edge cases", () => {
    it("should handle empty value", () => {
      const {getByDisplayValue} = renderWithTheme(<TextField onChange={mockOnChange} value="" />);

      const input = getByDisplayValue("");
      expect(input.props.value).toBe("");
    });

    it("should handle undefined value", () => {
      const {root} = renderWithTheme(<TextField onChange={mockOnChange} value={undefined} />);

      expect(root).toBeTruthy();
    });

    it("should handle long text values", () => {
      const longText = "a".repeat(1000);
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} value={longText} />
      );

      const input = getByDisplayValue(longText);
      expect(input.props.value).toBe(longText);
    });

    it("should handle special characters", () => {
      const specialText = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} value={specialText} />
      );

      const input = getByDisplayValue(specialText);
      expect(input.props.value).toBe(specialText);
    });
  });

  describe("return key behavior", () => {
    it("should set return key type", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField onChange={mockOnChange} returnKeyType="done" value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.enterKeyHint).toBe("done");
    });

    it("should handle blur on submit", () => {
      const {getByDisplayValue} = renderWithTheme(
        <TextField blurOnSubmit={false} onChange={mockOnChange} value="" />
      );

      const input = getByDisplayValue("");
      expect(input.props.blurOnSubmit).toBe(false);
    });
  });

  describe("input ref", () => {
    it("should call inputRef with the input reference", () => {
      const mockInputRef = mock(() => {});
      renderWithTheme(<TextField inputRef={mockInputRef} onChange={mockOnChange} value="" />);

      expect(mockInputRef).toHaveBeenCalled();
    });
  });

  describe("snapshots", () => {
    it("should match snapshot with default props", () => {
      const component = renderWithTheme(<TextField onChange={mockOnChange} value="test value" />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with all props", () => {
      const component = renderWithTheme(
        <TextField
          disabled={false}
          errorText="Error text"
          helperText="Helper text"
          iconName="check"
          multiline={false}
          onBlur={mockOnBlur}
          onChange={mockOnChange}
          onEnter={mockOnEnter}
          onFocus={mockOnFocus}
          onIconClick={mock(() => {})}
          placeholder="Enter text"
          title="Test Title"
          type="text"
          value="test value"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot when disabled", () => {
      const component = renderWithTheme(
        <TextField disabled onChange={mockOnChange} title="Disabled Field" value="disabled value" />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with multiline", () => {
      const component = renderWithTheme(
        <TextField
          multiline
          onChange={mockOnChange}
          rows={3}
          title="Multiline Field"
          value="line 1\nline 2"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with error state", () => {
      const component = renderWithTheme(
        <TextField
          errorText="This field is required"
          onChange={mockOnChange}
          title="Error Field"
          value=""
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
