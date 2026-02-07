import {describe, expect, it} from "bun:test";

import {Radio} from "./Radio";
import {renderWithTheme} from "./test-utils";

describe("Radio", () => {
  it("renders correctly when not selected", () => {
    const {toJSON} = renderWithTheme(<Radio selected={false} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly when selected", () => {
    const {toJSON} = renderWithTheme(<Radio selected />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("shows inner circle when selected", () => {
    const {toJSON} = renderWithTheme(<Radio selected />);
    const snapshot = toJSON();
    // Should have nested View for the inner filled circle
    expect(snapshot).toMatchSnapshot();
  });

  it("does not show inner circle when not selected", () => {
    const {toJSON} = renderWithTheme(<Radio selected={false} />);
    const snapshot = toJSON();
    // Should only have outer circle, no inner content
    expect(snapshot).toMatchSnapshot();
  });
});
