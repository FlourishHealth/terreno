import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {ThemeProvider} from "../Theme";
import {FieldError} from "./FieldError";

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe("FieldError", () => {
  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<FieldError text="This field is required" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays error text", () => {
    const {getByText} = renderWithTheme(<FieldError text="Invalid email address" />);
    expect(getByText("Invalid email address")).toBeTruthy();
  });

  it("renders with icon", () => {
    const {toJSON} = renderWithTheme(<FieldError text="Error message" />);
    // The component should include an error icon
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders different error messages", () => {
    const messages = [
      "This field is required",
      "Please enter a valid email",
      "Password must be at least 8 characters",
    ];

    messages.forEach((message) => {
      const {getByText} = renderWithTheme(<FieldError text={message} />);
      expect(getByText(message)).toBeTruthy();
    });
  });
});
