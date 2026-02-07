import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";

import {ThemeProvider} from "../Theme";
import {FieldTitle} from "./FieldTitle";

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe("FieldTitle", () => {
  it("renders correctly", () => {
    const {toJSON} = renderWithTheme(<FieldTitle text="Email Address" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("displays title text", () => {
    const {getByText} = renderWithTheme(<FieldTitle text="Username" />);
    expect(getByText("Username")).toBeTruthy();
  });

  it("renders different titles", () => {
    const titles = ["First Name", "Last Name", "Email", "Password", "Phone Number"];

    titles.forEach((title) => {
      const {getByText} = renderWithTheme(<FieldTitle text={title} />);
      expect(getByText(title)).toBeTruthy();
    });
  });
});
