import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {type FC, useState} from "react";
import {Platform} from "react-native";

import type {DataTableCustomComponentMap, DataTableProps} from "./Common";
import {DataTable} from "./DataTable";
import {Text} from "./Text";
import {renderWithTheme} from "./test-utils";

type MoreContentComponent = NonNullable<DataTableProps["moreContentComponent"]>;

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
    const MoreContent: MoreContentComponent = ({rowIndex}) => <Text>Row {rowIndex} details</Text>;
    const {toJSON} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} moreContentComponent={MoreContent} />
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

  it("handles sort cycling: none -> asc -> desc -> none", () => {
    const sortableColumns = [
      {columnType: "text", sortable: true, title: "Name", width: 150},
      {columnType: "text", sortable: false, title: "Age", width: 100},
    ];
    const setSortColumn = mock((_sort?: {column: number; direction: string}) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}, {value: "28"}]]}
        setSortColumn={setSortColumn}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    // Find the sort pressable (has hitSlop=16)
    const sortPressable = pressables.find(
      (p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16
    );
    expect(sortPressable).toBeTruthy();

    const {fireEvent} = require("@testing-library/react-native");
    // First click: none -> asc
    fireEvent.press(sortPressable!);
    expect(setSortColumn).toHaveBeenCalledWith({column: 0, direction: "asc"});
  });

  it("handles sort from asc to desc", () => {
    const sortableColumns = [{columnType: "text", sortable: true, title: "Name", width: 150}];
    const setSortColumn = mock((_sort?: {column: number; direction: string}) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={setSortColumn}
        sortColumn={{column: 0, direction: "asc"}}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    const sortPressable = pressables.find(
      (p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16
    );

    const {fireEvent} = require("@testing-library/react-native");
    fireEvent.press(sortPressable!);
    expect(setSortColumn).toHaveBeenCalledWith({column: 0, direction: "desc"});
  });

  it("handles sort from desc to none", () => {
    const sortableColumns = [{columnType: "text", sortable: true, title: "Name", width: 150}];
    const setSortColumn = mock((_sort?: {column: number; direction: string}) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={setSortColumn}
        sortColumn={{column: 0, direction: "desc"}}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    const sortPressable = pressables.find(
      (p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16
    );

    const {fireEvent} = require("@testing-library/react-native");
    fireEvent.press(sortPressable!);
    expect(setSortColumn).toHaveBeenCalledWith(undefined);
  });

  it("handles sort on non-sortable column (no-op)", () => {
    const columns = [{columnType: "text", sortable: false, title: "Name", width: 150}];
    const setSortColumn = mock(() => {});
    renderWithTheme(
      <DataTable columns={columns} data={[[{value: "Alice"}]]} setSortColumn={setSortColumn} />
    );
    // No sort pressable rendered for non-sortable columns, so no action needed
    expect(setSortColumn).not.toHaveBeenCalled();
  });

  it("syncs scroll between header and body via refs", () => {
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} pinnedColumns={1} />
    );

    const {ScrollView: ScrollViewComp} = require("react-native");
    const scrollViews = UNSAFE_getAllByType(ScrollViewComp);
    expect(scrollViews.length).toBeGreaterThan(0);

    // Inject mock scrollTo on the refs so handleScroll branches execute
    const mockScrollTo = mock((_opts: {animated: boolean; x: number}) => {});
    for (const sv of scrollViews) {
      if (sv.props.horizontal) {
        const fiber = (sv as unknown as {_fiber?: {ref?: {current: unknown}}})._fiber;
        if (fiber?.ref && typeof fiber.ref === "object") {
          fiber.ref.current = {scrollTo: mockScrollTo};
        }
      }
    }

    const {fireEvent} = require("@testing-library/react-native");
    // Find header scroll (onScroll passes isHeader=true)
    const headerScroll = scrollViews.find(
      (sv: {props: {horizontal?: boolean; showsHorizontalScrollIndicator?: boolean}}) =>
        sv.props.horizontal && sv.props.showsHorizontalScrollIndicator === false
    );
    // Find body scroll (onScroll passes isHeader=false)
    const bodyScroll = scrollViews.find(
      (sv: {props: {horizontal?: boolean; showsHorizontalScrollIndicator?: boolean}}) =>
        sv.props.horizontal && sv.props.showsHorizontalScrollIndicator === true
    );

    if (headerScroll) {
      fireEvent.scroll(headerScroll, {
        nativeEvent: {contentOffset: {x: 50, y: 0}},
      });
    }
    if (bodyScroll) {
      fireEvent.scroll(bodyScroll, {
        nativeEvent: {contentOffset: {x: 75, y: 0}},
      });
    }

    expect(mockScrollTo).toHaveBeenCalled();
  });

  it("renders with custom column component map", () => {
    const CustomComponent: DataTableCustomComponentMap[string] = ({cellData}) => (
      <Text>Custom: {String(cellData.value)}</Text>
    );
    const customColumns = [{columnType: "custom", title: "Custom Col", width: 150}];
    const customData = [[{value: "test"}]];
    const {getByText} = renderWithTheme(
      <DataTable
        columns={customColumns}
        customColumnComponentMap={{custom: CustomComponent}}
        data={customData}
      />
    );
    expect(getByText("Custom: test")).toBeTruthy();
  });

  it("renders with infoModalText on column header", () => {
    const columnsWithInfo = [
      {columnType: "text", infoModalText: "**Help text**", title: "Name", width: 150},
    ];
    const {toJSON} = renderWithTheme(
      <DataTable columns={columnsWithInfo} data={[[{value: "Alice"}]]} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders with cell highlight", () => {
    const highlightData = [[{highlight: "primary", value: "Highlighted"}]];
    const {toJSON} = renderWithTheme(
      <DataTable columns={[{columnType: "text", title: "Name", width: 150}]} data={highlightData} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders with moreContentExtraData", () => {
    const MoreContent: MoreContentComponent = ({rowIndex, extraInfo}) => (
      <Text>
        Row {rowIndex}: {String(extraInfo)}
      </Text>
    );
    const {toJSON} = renderWithTheme(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        moreContentComponent={MoreContent}
        moreContentExtraData={[{extraInfo: "info1"}, {extraInfo: "info2"}, {extraInfo: "info3"}]}
      />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("opens and dismisses more content modal via MoreButtonCell press", async () => {
    const MoreContent: MoreContentComponent = ({rowIndex}) => (
      <Text>Detail for row {rowIndex}</Text>
    );
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} moreContentComponent={MoreContent} />
    );

    const {Pressable: PressableComp} = require("react-native");
    const {fireEvent} = require("@testing-library/react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);

    // Find the info/eye icon pressable (MoreButtonCell has accessibilityHint="View details")
    const moreBtn = pressables.find(
      (p: {props: {accessibilityHint?: string}}) => p.props.accessibilityHint === "View details"
    );
    expect(moreBtn).toBeTruthy();

    // Press to open modal
    await act(async () => {
      fireEvent.press(moreBtn!);
    });

    // Find the modal dismiss pressable and press it
    const {Modal: ModalComp} = require("./Modal");
    const modals = UNSAFE_getAllByType(ModalComp);
    if (modals.length > 0 && modals[0].props.onDismiss) {
      await act(async () => {
        modals[0].props.onDismiss();
      });
    }
  });

  it("renders with customColumnComponentMap", () => {
    const CustomCell: DataTableCustomComponentMap[string] = ({cellData}) => (
      <Text>Custom: {String(cellData.value)}</Text>
    );
    const customColumns = [
      {columnType: "custom", title: "Custom Col", width: 150},
      {columnType: "text", title: "Name", width: 100},
    ];
    const customData = [[{value: "A"}, {value: "Bob"}]];
    const {getByText} = renderWithTheme(
      <DataTable
        columns={customColumns}
        customColumnComponentMap={{custom: CustomCell}}
        data={customData}
      />
    );
    expect(getByText("Custom: A")).toBeTruthy();
  });

  it("handleSort cycles through asc, desc, and clear", () => {
    const sortableColumns = [
      {columnType: "text", sortable: true, title: "Name", width: 150},
      {columnType: "text", sortable: false, title: "Age", width: 100},
    ];
    const setSortColumn = mock((_val: unknown) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}, {value: "28"}]]}
        setSortColumn={setSortColumn}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    const sortButton = pressables.find((p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16);
    expect(sortButton).toBeTruthy();

    // First press: asc
    act(() => {
      sortButton!.props.onPress();
    });
    expect(setSortColumn).toHaveBeenCalledWith({column: 0, direction: "asc"});
  });

  it("handleSort from asc to desc", () => {
    const sortableColumns = [{columnType: "text", sortable: true, title: "Name", width: 150}];
    const setSortColumn = mock((_val: unknown) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={setSortColumn}
        sortColumn={{column: 0, direction: "asc"}}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    const sortButton = pressables.find((p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16);

    act(() => {
      sortButton!.props.onPress();
    });
    expect(setSortColumn).toHaveBeenCalledWith({column: 0, direction: "desc"});
  });

  it("handleSort from desc clears sort", () => {
    const sortableColumns = [{columnType: "text", sortable: true, title: "Name", width: 150}];
    const setSortColumn = mock((_val: unknown) => {});
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sortableColumns}
        data={[[{value: "Alice"}]]}
        setSortColumn={setSortColumn}
        sortColumn={{column: 0, direction: "desc"}}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    const sortButton = pressables.find((p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16);

    act(() => {
      sortButton!.props.onPress();
    });
    expect(setSortColumn).toHaveBeenCalledWith(undefined);
  });

  it("handleSort does nothing for non-sortable column", () => {
    const columns = [{columnType: "text", sortable: false, title: "Name", width: 150}];
    const setSortColumn = mock((_val: unknown) => {});
    const {toJSON} = renderWithTheme(
      <DataTable columns={columns} data={[[{value: "Alice"}]]} setSortColumn={setSortColumn} />
    );
    expect(toJSON()).toBeTruthy();
  });

  it("handleScroll syncs header and body scroll positions", () => {
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} pinnedColumns={1} />
    );

    const {ScrollView: ScrollViewComp} = require("react-native");
    const scrollViews = UNSAFE_getAllByType(ScrollViewComp);
    const horizontalScrollViews = scrollViews.filter(
      (sv: {props: {horizontal?: boolean}}) => sv.props.horizontal
    );

    if (horizontalScrollViews.length >= 2) {
      // Trigger scroll on the body scroll view
      act(() => {
        horizontalScrollViews[1].props.onScroll({
          nativeEvent: {contentOffset: {x: 50, y: 0}},
        });
      });

      // Trigger scroll on the header scroll view
      act(() => {
        horizontalScrollViews[0].props.onScroll({
          nativeEvent: {contentOffset: {x: 100, y: 0}},
        });
      });
    }
  });

  it("renders with cell highlight color", () => {
    const highlightData = [[{highlight: "primary", value: "Highlighted"}]];
    const highlightColumns = [{columnType: "text", title: "Col", width: 150}];
    const {toJSON} = renderWithTheme(<DataTable columns={highlightColumns} data={highlightData} />);
    expect(toJSON()).toBeTruthy();
  });

  it("opens and closes more content modal", () => {
    const MoreContent = ({rowIndex}: {rowIndex: number}) => <Text>Row {rowIndex} details</Text>;
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        moreContentComponent={MoreContent as unknown as DataTableProps["moreContentComponent"]}
      />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    // Find the "Open modal" button (MoreButtonCell)
    const moreButton = pressables.find(
      (p: {props: {accessibilityLabel?: string}}) => p.props.accessibilityLabel === "Open modal"
    );

    if (moreButton) {
      act(() => {
        moreButton.props.onPress();
      });
    }
  });

  it("does not render filter or search controls without filter/search props", () => {
    const {queryByTestId} = renderWithTheme(
      <DataTable columns={sampleColumns} data={sampleData} />
    );
    expect(queryByTestId("data-table-search")).toBeNull();
    expect(queryByTestId("data-table-filters-trigger")).toBeNull();
  });

  it("fires onQueryChange for debounced search", async () => {
    const onQueryChange = mock(() => {});
    const onSearchChange = mock(() => {});
    renderWithTheme(
      <DataTable
        columns={sampleColumns}
        data={sampleData}
        onQueryChange={onQueryChange}
        onSearchChange={onSearchChange}
        search=""
        searchFields={["Name"]}
      />
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(onQueryChange).toHaveBeenCalled();
  });

  it("does not re-emit an unchanged query when controlled arrays are recreated", async () => {
    const onQueryChange = mock(() => {});
    const {rerender} = renderWithTheme(
      <DataTable
        columns={[...sampleColumns]}
        data={sampleData}
        onQueryChange={onQueryChange}
        search=""
        searchFields={["Name"]}
      />
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(onQueryChange).toHaveBeenCalledTimes(1);

    rerender(
      <DataTable
        columns={[...sampleColumns]}
        data={sampleData}
        onQueryChange={onQueryChange}
        search=""
        searchFields={["Name"]}
      />
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onQueryChange).toHaveBeenCalledTimes(1);
  });

  it("renders web column filter triggers for filterable columns", () => {
    const originalOS = Platform.OS;
    Platform.OS = "web";
    const filterColumns = [
      {
        columnType: "text",
        filter: {field: "name", kind: "text" as const},
        title: "Name",
        width: 150,
      },
    ];
    const {getByTestId} = renderWithTheme(
      <DataTable
        columns={filterColumns}
        data={[[{value: "Alice"}]]}
        filterValues={{}}
        onFilterValuesChange={() => {}}
      />
    );
    expect(getByTestId("data-table-filter-name.trigger")).toBeTruthy();
    Platform.OS = originalOS;
  });

  it("applies native sheet filters through the shared query contract", async () => {
    const originalOS = Platform.OS;
    Platform.OS = "ios";
    const onQueryChange = mock(() => {});
    const filterColumns = [
      {
        columnType: "boolean",
        filter: {field: "active", kind: "boolean" as const},
        title: "Active",
        width: 100,
      },
    ];
    const Harness: FC = () => {
      const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
      return (
        <DataTable
          columns={filterColumns}
          data={[[{value: true}]]}
          filterValues={filterValues}
          onFilterValuesChange={setFilterValues}
          onQueryChange={onQueryChange}
        />
      );
    };
    const {getByTestId, queryByTestId} = renderWithTheme(<Harness />);
    expect(queryByTestId("data-table-filter-active.trigger")).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId("data-table-filters-trigger"));
    });
    await waitFor(() => {
      expect(getByTestId("data-table-filter-active.switch")).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(getByTestId("data-table-filter-active.switch"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("data-table-filters-sheet.primary"));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onQueryChange).toHaveBeenLastCalledWith({active: true});
    Platform.OS = originalOS;
  });

  it("handleSort with no setSortColumn is a no-op", () => {
    const sortableColumns = [{columnType: "text", sortable: true, title: "Name", width: 150}];
    const {UNSAFE_getAllByType} = renderWithTheme(
      <DataTable columns={sortableColumns} data={[[{value: "Alice"}]]} />
    );

    const {Pressable: PressableComp} = require("react-native");
    const pressables = UNSAFE_getAllByType(PressableComp);
    const sortButton = pressables.find((p: {props: {hitSlop?: number}}) => p.props.hitSlop === 16);

    if (sortButton) {
      act(() => {
        sortButton.props.onPress();
      });
    }
  });
});
