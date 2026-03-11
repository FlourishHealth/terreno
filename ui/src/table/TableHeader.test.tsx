import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {Table} from "./Table";
import {TableHeader} from "./TableHeader";
import {TableHeaderCell} from "./TableHeaderCell";
import {TableRow} from "./TableRow";
import {TableText} from "./TableText";

describe("TableHeader", () => {
  it("renders correctly with children", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100, 100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Column 1" />
          <TableHeaderCell index={1} title="Column 2" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with tableHeaderGroup display (default)", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader display="tableHeaderGroup">
          <TableHeaderCell index={0} title="Visible" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with visuallyHidden display", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader display="visuallyHidden">
          <TableHeaderCell index={0} title="Hidden" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom color", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader color="neutralLight">
          <TableHeaderCell index={0} title="Custom Color" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
