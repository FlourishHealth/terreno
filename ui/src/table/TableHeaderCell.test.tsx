import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {Text} from "../Text";
import {renderWithTheme} from "../test-utils";
import {Table} from "./Table";
import {TableHeader} from "./TableHeader";
import {TableHeaderCell} from "./TableHeaderCell";
import {TableRow} from "./TableRow";
import {TableText} from "./TableText";

describe("TableHeaderCell", () => {
  it("renders correctly with title", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Name" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly with children", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0}>
            <Text>Custom Header</Text>
          </TableHeaderCell>
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with left alignment (default)", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} title="Left Aligned" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with center alignment", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell align="center" index={0} title="Centered" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with right alignment", () => {
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell align="right" index={0} title="Right Aligned" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders sortable header", () => {
    const handleSort = mock(() => {});
    const {toJSON} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} onSortChange={handleSort} sortable title="Sortable" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders sortable header with sort indicator when sorted", () => {
    const handleSort = mock((direction: string | undefined) => {});
    const {toJSON} = renderWithTheme(
      <Table columns={[100]} sort={{column: 0, direction: "desc"}}>
        <TableHeader>
          <TableHeaderCell index={0} onSortChange={handleSort} sortable title="Sorted Column" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    // Sortable header with active sort indicator
    expect(toJSON()).toMatchSnapshot();
  });
});
