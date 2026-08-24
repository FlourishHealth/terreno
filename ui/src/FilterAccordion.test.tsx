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

  it("renders the changes badge when requested", () => {
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} showChangesBadge testID="acc" />
    );
    expect(getByTestId("acc.badge")).toBeTruthy();
  });

  it("toggles via Space and ignores auto-repeat and other keys", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} onToggle={onToggle} testID="acc" />
    );
    const header = getByTestId("acc.header");
    fireEvent(header, "keyDown", {key: "Enter", preventDefault: mock()});
    expect(onToggle).not.toHaveBeenCalled();

    const preventDefault = mock();
    fireEvent(header, "keyDown", {key: " ", preventDefault, repeat: true});
    expect(preventDefault).toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();

    fireEvent(header, "keyDown", {key: " ", preventDefault: mock(), repeat: false});
    expect(onToggle).toHaveBeenCalledWith(true);

    fireEvent(header, "keyDown", {key: "Spacebar", preventDefault: mock()});
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("applies hover background when collapsed", () => {
    const {getByTestId} = renderWithTheme(<FilterAccordion {...defaultProps} testID="acc" />);
    const root = getByTestId("acc");
    fireEvent(getByTestId("acc.header"), "hoverIn");
    expect(root.props.style.backgroundColor).toBeTruthy();
    fireEvent(getByTestId("acc.header"), "hoverOut");
    expect(root.props.style.backgroundColor).toBeTruthy();
  });
});
