import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {type StyleProp, StyleSheet, type ViewStyle} from "react-native";

import {FilterBoolean} from "./FilterBoolean";
import {renderWithTheme} from "./test-utils";

const flattenBackgroundColor = (style: StyleProp<ViewStyle>): string | undefined => {
  const flattened = StyleSheet.flatten(style);
  return typeof flattened?.backgroundColor === "string" ? flattened.backgroundColor : undefined;
};

describe("FilterBoolean", () => {
  const defaultProps = {
    onChange: () => {},
    title: "Urgent only",
    value: false,
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<FilterBoolean {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the title", () => {
    const {getByText} = renderWithTheme(<FilterBoolean {...defaultProps} />);
    expect(getByText("Urgent only")).toBeTruthy();
  });

  it("toggles when the entire row is pressed", () => {
    const onChange = mock();
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} onChange={onChange} testID="toggle" value={false} />
    );
    fireEvent.press(getByTestId("toggle"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not toggle when disabled", () => {
    const onChange = mock();
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} disabled onChange={onChange} testID="toggle" />
    );
    fireEvent.press(getByTestId("toggle"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("exposes the checked state to assistive technology", () => {
    const on = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" value />);
    expect(on.getByTestId("toggle")).toHaveProp("accessibilityState", {
      checked: true,
      disabled: false,
    });

    const off = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" value={false} />);
    expect(off.getByTestId("toggle")).toHaveProp("accessibilityState", {
      checked: false,
      disabled: false,
    });
  });

  it("toggles on spacebar and ignores other keys", () => {
    const onChange = mock();
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} onChange={onChange} testID="toggle" value={false} />
    );
    const preventDefault = mock();

    fireEvent(getByTestId("toggle"), "keyDown", {key: "a", preventDefault});
    expect(onChange).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();

    fireEvent(getByTestId("toggle"), "keyDown", {key: " ", preventDefault});
    expect(preventDefault).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(true);

    fireEvent(getByTestId("toggle"), "keyDown", {key: "Spacebar", preventDefault});
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ignores auto-repeated spacebar events", () => {
    const onChange = mock();
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} onChange={onChange} testID="toggle" />
    );

    fireEvent(getByTestId("toggle"), "keyDown", {
      key: " ",
      preventDefault: () => {},
      repeat: true,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tints the row while hovered and restores the base color on hover out", () => {
    const {getByTestId} = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" />);
    const row = getByTestId("toggle");
    const baseColor = flattenBackgroundColor(row.props.style);

    fireEvent(row, "hoverIn");
    const hoveredColor = flattenBackgroundColor(getByTestId("toggle").props.style);
    expect(hoveredColor).not.toBe(baseColor);

    fireEvent(getByTestId("toggle"), "hoverOut");
    expect(flattenBackgroundColor(getByTestId("toggle").props.style)).toBe(baseColor);
  });

  it("keeps the base row color while hovered when disabled", () => {
    const {getByTestId} = renderWithTheme(
      <FilterBoolean {...defaultProps} disabled testID="toggle" />
    );
    const baseColor = flattenBackgroundColor(getByTestId("toggle").props.style);

    fireEvent(getByTestId("toggle"), "hoverIn");
    expect(flattenBackgroundColor(getByTestId("toggle").props.style)).toBe(baseColor);
  });

  it("uses a thicker focus border when focused", () => {
    const unfocused = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" />);
    const focused = renderWithTheme(<FilterBoolean {...defaultProps} focused testID="toggle" />);

    const unfocusedTrack = unfocused.getByTestId("toggle.switch").props.style as ViewStyle;
    const focusedTrack = focused.getByTestId("toggle.switch").props.style as ViewStyle;

    expect(unfocusedTrack.borderWidth).toBe(1);
    expect(focusedTrack.borderWidth).toBe(2);
    expect(focusedTrack.borderColor).not.toBe(unfocusedTrack.borderColor);
  });

  it("uses the disabled track color when disabled", () => {
    const enabled = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" value />);
    const disabled = renderWithTheme(
      <FilterBoolean {...defaultProps} disabled testID="toggle" value />
    );

    const enabledTrack = enabled.getByTestId("toggle.switch").props.style as ViewStyle;
    const disabledTrack = disabled.getByTestId("toggle.switch").props.style as ViewStyle;

    expect(disabledTrack.backgroundColor).not.toBe(enabledTrack.backgroundColor);
  });

  it("aligns the knob based on the value", () => {
    const on = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" value />);
    const off = renderWithTheme(<FilterBoolean {...defaultProps} testID="toggle" value={false} />);

    expect((on.getByTestId("toggle.switch").props.style as ViewStyle).alignItems).toBe("flex-end");
    expect((off.getByTestId("toggle.switch").props.style as ViewStyle).alignItems).toBe(
      "flex-start"
    );
  });

  it("shows the changes badge only when enabled", () => {
    const {queryByTestId, rerender} = renderWithTheme(
      <FilterBoolean {...defaultProps} testID="toggle" />
    );
    expect(queryByTestId("toggle.badge")).toBeNull();

    rerender(<FilterBoolean {...defaultProps} showChangesBadge testID="toggle" />);
    expect(queryByTestId("toggle.badge")).toBeTruthy();
  });
});
