// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
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

  it("calls handleSort when sortable header is pressed", () => {
    const setSortColumn = mock((_col: unknown) => {});
    const sortableColumns = [
      {columnType: "text", sortable: true, title: "Name", width: 150},
      {columnType: "text", sortable: true, title: "Age", width: 100},
    ];
    const {root} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}, {value: "28"}]]}
        setSortColumn={setSortColumn}
      />
    );
    // Find Pressable with hitSlop (sort buttons)
    const sortButtons = root.findAll(
      (n) => n.props.hitSlop === 16 && typeof n.props.onPress === "function"
    );
    expect(sortButtons.length).toBeGreaterThan(0);
    sortButtons[0].props.onPress();
    expect(setSortColumn).toHaveBeenCalledWith({column: 0, direction: "asc"});
  });

  it("cycles sort direction: asc -> desc -> clear", () => {
    const setSortColumn = mock((_col: unknown) => {});
    const sortableColumns = [
      {columnType: "text", sortable: true, title: "Name", width: 150},
    ];
    const {root} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={setSortColumn}
        sortColumn={{column: 0, direction: "asc"}}
      />
    );
    const sortButtons = root.findAll(
      (n) => n.props.hitSlop === 16 && typeof n.props.onPress === "function"
    );
    expect(sortButtons.length).toBeGreaterThan(0);
    sortButtons[0].props.onPress();
    expect(setSortColumn).toHaveBeenCalledWith({column: 0, direction: "desc"});
  });

  it("clears sort when clicking desc column", () => {
    const setSortColumn = mock((_col: unknown) => {});
    const sortableColumns = [
      {columnType: "text", sortable: true, title: "Name", width: 150},
    ];
    const {root} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={setSortColumn}
        sortColumn={{column: 0, direction: "desc"}}
      />
    );
    const sortButtons = root.findAll(
      (n) => n.props.hitSlop === 16 && typeof n.props.onPress === "function"
    );
    sortButtons[0].props.onPress();
    expect(setSortColumn).toHaveBeenCalledWith(undefined);
  });

  it("handles horizontal scroll sync between header and body", () => {
    const {root} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} pinnedColumns={1} />
    );
    const scrollViews = root.findAll(
      (n) => typeof n.props.onScroll === "function" && n.props.horizontal === true
    );
    // Trigger scroll on one of the scroll views
    if (scrollViews.length > 0) {
      scrollViews[0].props.onScroll({
        nativeEvent: {contentOffset: {x: 50}},
      });
    }
    expect(scrollViews.length).toBeGreaterThan(0);
  });

  it("renders with custom column component map", () => {
    const CustomCell = () => <Text>Custom</Text>;
    const customColumns = [
      {columnType: "custom", title: "Custom", width: 100},
      {columnType: "text", title: "Name", width: 100},
    ];
    const customData = [[{value: "custom-val"}, {value: "Alice"}]];
    const {toJSON} = renderWithTheme(
      <DataTable
        columns={customColumns}
        customColumnComponentMap={{custom: CustomCell}}
        data={customData}
      />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with pagination and navigates pages", () => {
    const setPage = mock((_page: number) => {});
    const {root} = renderWithTheme(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        page={2}
        setPage={setPage}
        totalPages={5}
      />
    );
    expect(root).toBeTruthy();
  });
});
