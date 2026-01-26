import {describe, expect, it} from "bun:test";
import {renderWithTheme} from "../test-utils";
import {Table} from "./Table";
import {TableHeader} from "./TableHeader";
import {TableHeaderCell} from "./TableHeaderCell";
import {TableRow} from "./TableRow";
import {TableText} from "./TableText";

describe("Table", () => {
  it("renders correctly with basic setup", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100, 100, 100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Name" />
          <TableHeaderCell index={1} title="Age" />
          <TableHeaderCell index={2} title="City" />
        </TableHeader>
        <TableRow>
          <TableText value="John" />
          <TableText value="30" />
          <TableText value="NYC" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders multiple rows", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100, 100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Name" />
          <TableHeaderCell index={1} title="Value" />
        </TableHeader>
        <TableRow>
          <TableText value="Item 1" />
          <TableText value="100" />
        </TableRow>
        <TableRow>
          <TableText value="Item 2" />
          <TableText value="200" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without alternate row background", () => {
    const {toJSON} = renderWithTheme(
      <Table alternateRowBackground={false} columns={[100, 100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Col 1" />
          <TableHeaderCell index={1} title="Col 2" />
        </TableHeader>
        <TableRow>
          <TableText value="A" />
          <TableText value="B" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with percentage-based columns", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={["50%", "50%"]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Left" />
          <TableHeaderCell index={1} title="Right" />
        </TableHeader>
        <TableRow>
          <TableText value="Left content" />
          <TableText value="Right content" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with maxHeight", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]} maxHeight={200}>
        <TableHeader>
          <TableHeaderCell index={0} title="Column" />
        </TableHeader>
        <TableRow>
          <TableText value="Row 1" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without sticky header", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]} stickyHeader={false}>
        <TableHeader>
          <TableHeaderCell index={0} title="Column" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
