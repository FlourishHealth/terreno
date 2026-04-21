import {afterAll, describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {Pressable, Text as RNText} from "react-native";

// Override the IconButton mock so the inline onClick arrow fires when pressed.
mock.module("./IconButton", () => ({
  IconButton: ({
    accessibilityLabel,
    accessibilityHint,
    iconName,
    onClick,
    tooltipText,
  }: {
    accessibilityLabel?: string;
    accessibilityHint?: string;
    iconName: string;
    onClick?: () => void;
    tooltipText?: string;
  }) => (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      onPress={onClick}
      testID={`icon-button-${iconName}`}
    >
      <RNText>{tooltipText}</RNText>
    </Pressable>
  ),
}));

afterAll(() => {
  mock.module("./IconButton", () => ({
    IconButton: mock(() => null),
  }));
});

import {InfoTooltipButton} from "./InfoTooltipButton";
import {renderWithTheme} from "./test-utils";

describe("InfoTooltipButton", () => {
  it("renders correctly with text", () => {
    const {toJSON} = renderWithTheme(<InfoTooltipButton text="Help information" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with different tooltip text", () => {
    const {toJSON} = renderWithTheme(<InfoTooltipButton text="Click for more details" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders info icon", () => {
    const {toJSON} = renderWithTheme(<InfoTooltipButton text="Tooltip content" />);
    // The component renders an IconButton with exclamation icon
    expect(toJSON()).toMatchSnapshot();
  });

  it("is defined and is a function component", () => {
    expect(InfoTooltipButton).toBeDefined();
    expect(typeof InfoTooltipButton).toBe("function");
  });

  it("accepts a text prop without throwing", () => {
    expect(() =>
      renderWithTheme(<InfoTooltipButton text="Some details that explain the field" />)
    ).not.toThrow();
  });

  it("fires the inline onClick handler when the IconButton is pressed", () => {
    const {getByTestId} = renderWithTheme(
      <InfoTooltipButton text="Some details that explain the field" />
    );
    expect(() => fireEvent.press(getByTestId("icon-button-exclamation"))).not.toThrow();
  });
});
