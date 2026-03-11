import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {SegmentedControl} from "./SegmentedControl";
import {renderWithTheme} from "./test-utils";

describe("SegmentedControl", () => {
  const defaultItems = ["Tab 1", "Tab 2", "Tab 3"];

  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<SegmentedControl items={defaultItems} selectedIndex={0} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders all items", () => {
    const {getByText} = renderWithTheme(
      <SegmentedControl items={defaultItems} selectedIndex={0} />
    );
    expect(getByText("Tab 1")).toBeTruthy();
    expect(getByText("Tab 2")).toBeTruthy();
    expect(getByText("Tab 3")).toBeTruthy();
  });

  it("highlights selected item", () => {
    const {toJSON} = renderWithTheme(<SegmentedControl items={defaultItems} selectedIndex={1} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls onChange when item is pressed", () => {
    const handleChange = mock((_index: number) => {});
    const {getByText} = renderWithTheme(
      <SegmentedControl items={defaultItems} onChange={handleChange} selectedIndex={0} />
    );

    fireEvent.press(getByText("Tab 2"));
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("renders with medium size (default)", () => {
    const {toJSON} = renderWithTheme(
      <SegmentedControl items={defaultItems} selectedIndex={0} size="md" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with large size", () => {
    const {toJSON} = renderWithTheme(
      <SegmentedControl items={defaultItems} selectedIndex={0} size="lg" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with badges", () => {
    const badges = [
      {count: 5, status: "info" as const},
      {count: 3, status: "warning" as const},
      {count: 1, status: "error" as const},
    ];
    const {toJSON} = renderWithTheme(
      <SegmentedControl badges={badges} items={defaultItems} selectedIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with maxItems and scroll buttons", () => {
    const manyItems = ["Tab 1", "Tab 2", "Tab 3", "Tab 4", "Tab 5", "Tab 6"];
    const {toJSON} = renderWithTheme(
      <SegmentedControl items={manyItems} maxItems={3} selectedIndex={0} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("handles scroll navigation", () => {
    const manyItems = ["Tab 1", "Tab 2", "Tab 3", "Tab 4", "Tab 5", "Tab 6"];
    const {getByText, toJSON} = renderWithTheme(
      <SegmentedControl items={manyItems} maxItems={3} selectedIndex={0} />
    );
    // Initially shows first 3 items
    expect(getByText("Tab 1")).toBeTruthy();
    expect(getByText("Tab 2")).toBeTruthy();
    expect(getByText("Tab 3")).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });
});
