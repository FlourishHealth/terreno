import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {TableText} from "./TableText";

describe("TableText", () => {
  it("renders correctly with value", () => {
    const {toJSON} = renderWithTheme(<TableText value="Test Value" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with left alignment (default)", () => {
    const {getByText} = renderWithTheme(<TableText value="Left aligned" />);
    expect(getByText("Left aligned")).toBeTruthy();
  });

  it("renders with center alignment", () => {
    const {toJSON} = renderWithTheme(<TableText align="center" value="Centered" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right alignment", () => {
    const {toJSON} = renderWithTheme(<TableText align="right" value="Right aligned" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with isEditing prop (shows warning)", () => {
    const {toJSON} = renderWithTheme(<TableText isEditing value="Editing" />);
    expect(toJSON()).toMatchSnapshot();
  });
});
