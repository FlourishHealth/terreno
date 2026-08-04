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

  it("calls onToggle with the next state when controlled", () => {
    const onToggle = mock();
    const {getByTestId} = renderWithTheme(
      <FilterAccordion {...defaultProps} expanded={false} onToggle={onToggle} testID="acc" />
    );
    fireEvent.press(getByTestId("acc.header"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
