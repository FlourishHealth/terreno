import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {TableNumber} from "./TableNumber";

describe("TableNumber", () => {
  it("renders correctly with value", () => {
    const {toJSON} = renderWithTheme(<TableNumber value={42} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders number value", () => {
    const {getByText} = renderWithTheme(<TableNumber value={123} />);
    expect(getByText("123")).toBeTruthy();
  });

  it("renders with right alignment (default)", () => {
    const {toJSON} = renderWithTheme(<TableNumber value={100} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with left alignment", () => {
    const {toJSON} = renderWithTheme(<TableNumber align="left" value={100} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with center alignment", () => {
    const {toJSON} = renderWithTheme(<TableNumber align="center" value={100} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with isEditing prop (shows warning)", () => {
    const {toJSON} = renderWithTheme(<TableNumber isEditing value={99} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders decimal numbers", () => {
    const {getByText} = renderWithTheme(<TableNumber value={3.14} />);
    expect(getByText("3.14")).toBeTruthy();
  });

  it("renders negative numbers", () => {
    const {getByText} = renderWithTheme(<TableNumber value={-50} />);
    expect(getByText("-50")).toBeTruthy();
  });
});
