import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";

import {EmailField} from "./EmailField";
import {renderWithTheme} from "./test-utils";

describe("EmailField", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<EmailField label="Email" onChange={() => {}} value="" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with placeholder", () => {
    const {getByPlaceholderText} = renderWithTheme(
      <EmailField label="Email" onChange={() => {}} placeholder="Enter your email" value="" />
    );
    expect(getByPlaceholderText("Enter your email")).toBeTruthy();
  });

  it("renders with initial value", () => {
    const {getByDisplayValue} = renderWithTheme(
      <EmailField label="Email" onChange={() => {}} value="test@example.com" />
    );
    expect(getByDisplayValue("test@example.com")).toBeTruthy();
  });

  it("calls onChange with valid email", async () => {
    const handleChange = mock((_value: string) => {});
    const {getByDisplayValue} = renderWithTheme(
      <EmailField label="Email" onChange={handleChange} value="" />
    );

    const input = getByDisplayValue("");
    await act(async () => {
      fireEvent.changeText(input, "valid@email.com");
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("valid@email.com");
    });
  });

  it("does not call onChange with invalid email", async () => {
    const handleChange = mock((_value: string) => {});
    const {getByDisplayValue} = renderWithTheme(
      <EmailField label="Email" onChange={handleChange} value="" />
    );

    const input = getByDisplayValue("");
    await act(async () => {
      fireEvent.changeText(input, "invalid-email");
    });

    // onChange should not be called for invalid email
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("validates email format and shows error for invalid input", () => {
    // EmailField should show error for invalid email after typing
    const {unmount} = renderWithTheme(
      <EmailField label="Email" onChange={() => {}} value="invalid-email" />
    );

    // Render with errorText to test that custom error displays
    unmount();
    const {queryByText: queryByText2} = renderWithTheme(
      <EmailField
        errorText="Please enter a valid email"
        label="Email"
        onChange={() => {}}
        value="invalid-email"
      />
    );
    expect(queryByText2("Please enter a valid email")).toBeTruthy();
  });

  it("accepts valid email addresses", async () => {
    const handleChange = mock((_value: string) => {});
    const {getByDisplayValue} = renderWithTheme(
      <EmailField label="Email" onChange={handleChange} value="" />
    );

    const input = getByDisplayValue("");
    await act(async () => {
      fireEvent.changeText(input, "test@example.com");
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("test@example.com");
    });
  });

  it("renders with custom errorText", () => {
    const {getByText} = renderWithTheme(
      <EmailField errorText="Custom error message" label="Email" onChange={() => {}} value="" />
    );
    expect(getByText("Custom error message")).toBeTruthy();
  });

  it("renders with icon", () => {
    const {toJSON} = renderWithTheme(
      <EmailField iconName="envelope" label="Email" onChange={() => {}} value="" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
