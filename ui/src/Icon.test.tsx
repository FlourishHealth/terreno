import {describe, expect, it} from "bun:test";

import {Icon} from "./Icon";
import {renderWithTheme} from "./test-utils";

describe("Icon", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Icon iconName="check" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with testID", () => {
    const {toJSON} = renderWithTheme(<Icon iconName="check" testID="test-icon" />);
    // FontAwesome6 component receives testID prop
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with different sizes", () => {
    const sizes = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
    sizes.forEach((size) => {
      const {toJSON} = renderWithTheme(<Icon iconName="check" size={size} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  it("renders with different colors", () => {
    const colors = ["primary", "secondary", "accent", "inverted", "error"] as const;
    colors.forEach((color) => {
      const {toJSON} = renderWithTheme(<Icon color={color} iconName="star" />);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  it("renders with solid type (default)", () => {
    const {toJSON} = renderWithTheme(<Icon iconName="heart" type="solid" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with regular type", () => {
    const {toJSON} = renderWithTheme(<Icon iconName="heart" type="regular" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with light type", () => {
    const {toJSON} = renderWithTheme(<Icon iconName="heart" type="light" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with brand type", () => {
    const {toJSON} = renderWithTheme(<Icon iconName="github" type="brand" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders different icon names", () => {
    const icons = ["check", "x", "star", "heart", "user", "search"] as const;
    icons.forEach((iconName) => {
      const {toJSON} = renderWithTheme(<Icon iconName={iconName} />);
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
