import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import {StyleSheet} from "react-native";

import {FilterSelectMenu} from "./FilterSelectMenu";
import {renderWithTheme} from "./test-utils";

const OPTIONS = [
  {label: "All", value: "all"},
  {label: "Today", value: "today"},
];

describe("FilterSelectMenu", () => {
  const defaultProps = {
    onChange: () => {},
    options: OPTIONS,
    title: "Due date",
  };

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<FilterSelectMenu {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders the title", () => {
    const {getByText} = renderWithTheme(<FilterSelectMenu {...defaultProps} />);
    expect(getByText("Due date")).toBeTruthy();
  });

  it("shows the changes badge only when enabled", () => {
    const {queryByTestId, rerender} = renderWithTheme(
      <FilterSelectMenu {...defaultProps} testID="filter" />
    );
    expect(queryByTestId("filter.badge")).toBeNull();

    rerender(<FilterSelectMenu {...defaultProps} showChangesBadge testID="filter" />);
    expect(queryByTestId("filter.badge")).toBeTruthy();
  });

  it("renders the select control", () => {
    const {getByTestId} = renderWithTheme(
      <FilterSelectMenu {...defaultProps} onChange={mock()} testID="filter" value="all" />
    );
    expect(getByTestId("filter")).toBeTruthy();
  });

  it("tints the row while the select is hovered", () => {
    const {getByTestId} = renderWithTheme(
      <FilterSelectMenu {...defaultProps} testID="filter" value="all" />
    );
    const container = getByTestId("filter.selectContainer");
    const rowBackground = (): unknown =>
      StyleSheet.flatten(getByTestId("filter").props.style).backgroundColor;

    const initialBackground = rowBackground();
    fireEvent(container, "hoverIn");
    assert.notEqual(rowBackground(), initialBackground);

    fireEvent(container, "hoverOut");
    assert.equal(rowBackground(), initialBackground);
  });

  it("renders the placeholder and disabled state on the select", () => {
    const {getByTestId} = renderWithTheme(
      <FilterSelectMenu {...defaultProps} disabled placeholder="Select" testID="filter" />
    );
    expect(getByTestId("filter.select")).toBeTruthy();
  });

  it("clips the compact select control to its fixed width", () => {
    const {getByTestId} = renderWithTheme(
      <FilterSelectMenu {...defaultProps} testID="filter" value="all" />
    );
    const style = StyleSheet.flatten(getByTestId("filter.selectContainer").props.style);

    assert.equal(style.width, 138);
    assert.equal(style.overflow, "hidden");
  });
});
