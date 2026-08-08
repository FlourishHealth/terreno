import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";

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
    const handleSort = mock((_direction: string | undefined) => {});
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

  it("calls onSortChange with 'desc' when unsorted sortable header is clicked", async () => {
    const handleSort = mock((_direction: string | undefined) => {});
    const {getByLabelText} = renderWithTheme(
      <Table columns={[100]}>
        <TableHeader>
          <TableHeaderCell index={0} onSortChange={handleSort} sortable title="Sortable" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    await act(async () => {
      fireEvent.press(getByLabelText("sort"));
    });
    await waitFor(() => expect(handleSort).toHaveBeenCalledWith("desc"));
  });

  it("calls onSortChange with 'asc' when desc-sorted header is clicked", async () => {
    const handleSort = mock((_direction: string | undefined) => {});
    const {getByLabelText} = renderWithTheme(
      <Table columns={[100]} sort={{column: 0, direction: "desc"}}>
        <TableHeader>
          <TableHeaderCell index={0} onSortChange={handleSort} sortable title="Sortable" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    await act(async () => {
      fireEvent.press(getByLabelText("sort"));
    });
    await waitFor(() => expect(handleSort).toHaveBeenCalledWith("asc"));
  });

  it("calls onSortChange with undefined when asc-sorted header is clicked", async () => {
    const handleSort = mock((_direction: string | undefined) => {});
    const {getByLabelText} = renderWithTheme(
      <Table columns={[100]} sort={{column: 0, direction: "asc"}}>
        <TableHeader>
          <TableHeaderCell index={0} onSortChange={handleSort} sortable title="Sortable" />
        </TableHeader>
        <TableRow>
          <TableText value="Data" />
        </TableRow>
      </Table>
    );
    await act(async () => {
      fireEvent.press(getByLabelText("sort"));
    });
    await waitFor(() => expect(handleSort).toHaveBeenCalledWith(undefined));
  });

  it("warns when no width is defined for the column index", () => {
    const originalWarn = console.warn;
    const warnMock = mock(() => {});
    console.warn = warnMock;
    try {
      renderWithTheme(
        <Table columns={[100]}>
          <TableHeader>
            <TableHeaderCell index={5} title="Out of range" />
          </TableHeader>
          <TableRow>
            <TableText value="Data" />
          </TableRow>
        </Table>
      );
      expect(warnMock).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it("warns when both children and title are provided", () => {
    const originalWarn = console.warn;
    const warnMock = mock(() => {});
    console.warn = warnMock;
    try {
      renderWithTheme(
        <Table columns={[100]}>
          <TableHeader>
            <TableHeaderCell index={0} title="Title">
              <Text>Child</Text>
            </TableHeaderCell>
          </TableHeader>
          <TableRow>
            <TableText value="Data" />
          </TableRow>
        </Table>
      );
      expect(warnMock).toHaveBeenCalled();
    } finally {
      console.warn = originalWarn;
    }
  });

  it("logs error when sortable is true but onSortChange is missing", () => {
    const originalError = console.error;
    const errorMock = mock(() => {});
    console.error = errorMock;
    try {
      renderWithTheme(
        <Table columns={[100]}>
          <TableHeader>
            <TableHeaderCell index={0} sortable title="Sortable" />
          </TableHeader>
          <TableRow>
            <TableText value="Data" />
          </TableRow>
        </Table>
      );
      expect(errorMock).toHaveBeenCalled();
    } finally {
      console.error = originalError;
    }
  });

  it("logs error when neither children nor title is provided", () => {
    const originalError = console.error;
    const errorMock = mock(() => {});
    console.error = errorMock;
    try {
      renderWithTheme(
        <Table columns={[100]}>
          <TableHeader>
            <TableHeaderCell index={0} />
          </TableHeader>
          <TableRow>
            <TableText value="Data" />
          </TableRow>
        </Table>
      );
      expect(errorMock).toHaveBeenCalled();
    } finally {
      console.error = originalError;
    }
  });
});
