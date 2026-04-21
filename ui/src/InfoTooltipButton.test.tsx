import {describe, expect, it} from "bun:test";

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
});
