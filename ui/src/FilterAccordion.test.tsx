import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {FilterAccordion} from "./FilterAccordion";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("FilterAccordion", () => {
  const defaultProps = {
    title: "Status",
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<FilterAccordion {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the title", () => {
    const {getByText} = renderWithTheme(<FilterAccordion {...defaultProps} />);
    expect(getByText("Status")).toBeTruthy();
  });

  it("hides content until expanded", () => {
    const {queryByText, getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} testID="acc">
        <Text>Content</Text>
      </FilterAccordion>
    );
    expect(queryByText("Content")).toBeNull();
    fireEvent.press(getByTestId("acc.header"));
    expect(queryByText("Content")).toBeTruthy();
  });

  it("respects defaultExpanded", () => {
    const {getByText} = renderWithTheme(
      <FilterAccordion {...defaultProps} defaultExpanded>
        <Text>Content</Text>
      </FilterAccordion>
    );
    expect(getByText("Content")).toBeTruthy();
  });

  it("exposes the expanded state to assistive technology", () => {
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} expanded testID="acc" />
    );
    expect(getByTestId("acc.header")).toHaveProp("accessibilityState", {expanded: true});
  });

  it("calls onToggle with the next state when controlled", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} expanded={false} onToggle={onToggle} testID="acc" />
    );
    fireEvent.press(getByTestId("acc.header"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("shows the changes badge when showChangesBadge is set", () => {
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} showChangesBadge testID="acc" />
    );
    expect(getByTestId("acc.badge")).toBeTruthy();
  });

  it("changes background color on hover when collapsed", () => {
    const {getByTestId} = renderWithTheme(<FilterAccordion {...defaultProps} testID="acc" />);
    const initialColor = getByTestId("acc").props.style.backgroundColor;
    fireEvent(getByTestId("acc.header"), "hoverIn");
    expect(getByTestId("acc").props.style.backgroundColor).not.toBe(initialColor);
    fireEvent(getByTestId("acc.header"), "hoverOut");
    expect(getByTestId("acc").props.style.backgroundColor).toBe(initialColor);
  });

  it("toggles when Space is pressed on the header", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} onToggle={onToggle} testID="acc" />
    );
    fireEvent(getByTestId("acc.header"), "keyDown", {key: " ", preventDefault: () => {}});
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("toggles on the legacy Spacebar key name", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} onToggle={onToggle} testID="acc" />
    );
    fireEvent(getByTestId("acc.header"), "keyDown", {key: "Spacebar", preventDefault: () => {}});
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("ignores non-space keys", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} onToggle={onToggle} testID="acc" />
    );
    fireEvent(getByTestId("acc.header"), "keyDown", {key: "Enter", preventDefault: () => {}});
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("ignores held-key auto-repeat for Space", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} onToggle={onToggle} testID="acc" />
    );
    fireEvent(getByTestId("acc.header"), "keyDown", {
      key: " ",
      preventDefault: () => {},
      repeat: true,
    });
    expect(onToggle).not.toHaveBeenCalled();
  });
});
