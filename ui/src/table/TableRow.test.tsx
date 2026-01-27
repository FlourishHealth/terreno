import {describe, expect, it} from "bun:test";
import {Text} from "../Text";
import {renderWithTheme} from "../test-utils";
import {Table} from "./Table";
import {TableHeader} from "./TableHeader";
import {TableHeaderCell} from "./TableHeaderCell";
import {TableRow} from "./TableRow";
import {TableText} from "./TableText";

describe("TableRow", () => {
  it("renders correctly with children", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100, 100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Col 1" />
          <TableHeaderCell index={1} title="Col 2" />
        </TableHeader>
        <TableRow>
          <TableText value="Cell 1" />
          <TableText value="Cell 2" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders header row with thicker border", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableRow headerRow>
          <TableText value="Header" />
        </TableRow>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with drawer contents", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Name" />
        </TableHeader>
        <TableRow drawerContents={<Text>Expanded content</Text>}>
          <TableText value="Click to expand" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders drawer with expand button", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Name" />
        </TableHeader>
        <TableRow drawerContents={<Text>Expanded content</Text>}>
          <TableText value="Click to expand" />
        </TableRow>
      </Table>
    );
    // Drawer contents are hidden by default, expand button is rendered
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom color", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Column" />
        </TableHeader>
        <TableRow color="neutralLight">
          <TableText value="Light row" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
