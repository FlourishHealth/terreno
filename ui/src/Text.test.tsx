import {describe, expect, it, spyOn} from "bun:test";

import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("Text", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Text>Hello World</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders text content correctly", () => {
    const {getByText} = renderWithTheme(<Text>Test content</Text>);
    expect(getByText("Test content")).toBeTruthy();
  });

  // Size tests
  it("renders with sm size", () => {
    const {toJSON} = renderWithTheme(<Text size="sm">Small text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with md size (default)", () => {
    const {toJSON} = renderWithTheme(<Text size="md">Medium text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with lg size", () => {
    const {toJSON} = renderWithTheme(<Text size="lg">Large text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with xl size", () => {
    const {toJSON} = renderWithTheme(<Text size="xl">Extra large text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with 2xl size", () => {
    const {toJSON} = renderWithTheme(<Text size="2xl">2XL text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // Style tests
  it("renders bold text", () => {
    const {toJSON} = renderWithTheme(<Text bold>Bold text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders italic text", () => {
    const {toJSON} = renderWithTheme(<Text italic>Italic text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders bold italic text", () => {
    const {toJSON} = renderWithTheme(
      <Text bold italic>
        Bold italic text
      </Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders underlined text", () => {
    const {toJSON} = renderWithTheme(<Text underline>Underlined text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // Alignment tests
  it("renders with left alignment (default)", () => {
    const {toJSON} = renderWithTheme(<Text align="left">Left aligned</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with center alignment", () => {
    const {toJSON} = renderWithTheme(<Text align="center">Centered</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right alignment", () => {
    const {toJSON} = renderWithTheme(<Text align="right">Right aligned</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // Color tests
  it("renders with secondary color", () => {
    const {toJSON} = renderWithTheme(<Text color="secondary">Secondary color</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with accent color", () => {
    const {toJSON} = renderWithTheme(<Text color="accent">Accent color</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with link color", () => {
    const {toJSON} = renderWithTheme(<Text color="link">Link color</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  // Truncation tests
  it("renders with truncate", () => {
    const {toJSON} = renderWithTheme(
      <Text truncate>This is a long text that should be truncated</Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with numberOfLines", () => {
    const {toJSON} = renderWithTheme(<Text numberOfLines={2}>Multiple lines of text</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("logs error when truncate and numberOfLines > 1 are both set", () => {
    const consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});

    renderWithTheme(
      <Text numberOfLines={3} truncate>
        Invalid combination
      </Text>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith("Cannot truncate Text and have 3 lines");

    consoleErrorSpy.mockRestore();
  });

  // skipLinking tests
  it("renders with skipLinking", () => {
    const {toJSON} = renderWithTheme(<Text skipLinking>No hyperlinks</Text>);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with testID", () => {
    const {getByTestId} = renderWithTheme(<Text testID="test-text">Test</Text>);
    expect(getByTestId("test-text")).toBeTruthy();
  });

  // Combined style tests
  it("renders with multiple style props", () => {
    const {toJSON} = renderWithTheme(
      <Text align="center" bold color="accent" size="lg" underline>
        Styled text
      </Text>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
