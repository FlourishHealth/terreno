import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {TableTitle} from "./TableTitle";

describe("TableTitle", () => {
  it("renders correctly with title", () => {
    const {toJSON} = renderWithTheme(<TableTitle title="Column Header" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders title text", () => {
    const {getByText} = renderWithTheme(<TableTitle title="Name" />);
    expect(getByText("Name")).toBeTruthy();
  });

  it("renders with left alignment (default)", () => {
    const {toJSON} = renderWithTheme(<TableTitle title="Left Title" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with center alignment", () => {
    const {toJSON} = renderWithTheme(<TableTitle align="center" title="Centered Title" />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right alignment", () => {
    const {toJSON} = renderWithTheme(<TableTitle align="right" title="Right Title" />);
    expect(toJSON()).toMatchSnapshot();
  });
});
