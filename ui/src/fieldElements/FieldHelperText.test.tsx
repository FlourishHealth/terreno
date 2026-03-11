import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {ThemeProvider} from "../Theme";
import {FieldHelperText} from "./FieldHelperText";

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe("FieldHelperText", () => {
  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<FieldHelperText text="This is helper text" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays helper text", () => {
    const {getByText} = renderWithTheme(<FieldHelperText text="Enter your full name" />);
    expect(getByText("Enter your full name")).toBeTruthy();
  });

  it("renders different helper messages", () => {
    const messages = [
      "Optional field",
      "We'll never share your email",
      "At least 8 characters recommended",
    ];

    messages.forEach((message) => {
      const {getByText} = renderWithTheme(<FieldHelperText text={message} />);
      expect(getByText(message)).toBeTruthy();
    });
  });
});
