import {describe, expect, it, mock} from "bun:test";

import {DataTable} from "./DataTable";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

describe("DataTable", () => {
  const sampleColumns = [
    {columnType: "text", title: "Name", width: 150},
    {columnType: "text", title: "Age", width: 100},
    {columnType: "boolean", title: "Active", width: 100},
  ];

  const sampleData = [
    [{value: "John"}, {value: "30"}, {value: true}],
    [{value: "Jane"}, {value: "25"}, {value: false}],
    [{value: "Bob"}, {value: "40"}, {value: true}],
  ];

  it("renders correctly with basic data", () => {
    const {toJSON} = renderWithTheme(<DataTable columns={sampleColumns} data={sampleData} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with alternate row background (default)", () => {
    const {toJSON} = renderWithTheme(
      <DataTable alternateRowBackground columns={sampleColumns} data={sampleData} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders without alternate row background", () => {
    const {toJSON} = renderWithTheme(
      <DataTable alternateRowBackground={false} columns={sampleColumns} data={sampleData} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with pinned columns", () => {
    const {toJSON} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} pinnedColumns={1} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom row height", () => {
    const {toJSON} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} rowHeight={80} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with custom header height", () => {
    const {toJSON} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} headerHeight={60} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with pagination", () => {
    const setPage = mock((_page: number) => {});
    const {toJSON} = renderWithTheme(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        page={1}
        setPage={setPage}
        totalPages={5}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders sortable columns", () => {
    const sortableColumns = [
      {columnType: "text", sortable: true, title: "Name", width: 150},
      {columnType: "text", sortable: true, title: "Age", width: 100},
    ];
    const setSortColumn = mock(() => {});
    const {toJSON} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}, {value: "28"}]]}
        setSortColumn={setSortColumn}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with sort indicator", () => {
    const sortableColumns = [{columnType: "text", sortable: true, title: "Name", width: 150}];
    const {toJSON} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={() => {}}
        sortColumn={{column: 0, direction: "asc"}}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with different text sizes", () => {
    const {toJSON} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} defaultTextSize="sm" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with more content component", () => {
    const MoreContent = ({rowIndex}: {rowIndex: number}) => <Text>Row {rowIndex} details</Text>;
    const {toJSON} = renderWithTheme(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        moreContentComponent={MoreContent as any}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders boolean cells correctly", () => {
    const booleanColumns = [{columnType: "boolean", title: "Status", width: 100}];
    const booleanData = [[{value: true}], [{value: false}]];
    const {toJSON} = renderWithTheme(<DataTable columns={booleanColumns} data={booleanData} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders empty data", () => {
    const {toJSON} = renderWithTheme(<DataTable columns={sampleColumns} data={[]} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
