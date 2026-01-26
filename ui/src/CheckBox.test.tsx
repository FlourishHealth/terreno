import {describe, expect, it} from "bun:test";

import {CheckBox} from "./CheckBox";
import {renderWithTheme} from "./test-utils";

describe("CheckBox", () => {
  it("renders correctly when not selected", () => {
    const {toJSON} = renderWithTheme(<CheckBox selected={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly when selected", () => {
    const {toJSON} = renderWithTheme(<CheckBox selected />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with small size", () => {
    const {toJSON} = renderWithTheme(<CheckBox selected size="sm" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with medium size (default)", () => {
    const {toJSON} = renderWithTheme(<CheckBox selected size="md" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with large size", () => {
    const {toJSON} = renderWithTheme(<CheckBox selected size="lg" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with accent background color when selected", () => {
    const {toJSON} = renderWithTheme(<CheckBox bgColor="accent" selected />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with black background color when selected", () => {
    const {toJSON} = renderWithTheme(<CheckBox bgColor="black" selected />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with default background color when selected", () => {
    const {toJSON} = renderWithTheme(<CheckBox bgColor="default" selected />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("does not show check icon when not selected", () => {
    const {queryByTestId, toJSON} = renderWithTheme(<CheckBox selected={false} />);
    const snapshot = toJSON();
    // When not selected, the inner View should be empty (no icon)
    expect(snapshot).toMatchSnapshot();
  });
});
