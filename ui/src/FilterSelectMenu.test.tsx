import {describe, expect, it, mock} from "bun:test";

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
});
