import {assert} from "chai";
import React from "react";
import {act, create, type ReactTestInstance, type ReactTestRenderer} from "react-test-renderer";

import type {DataTableCellData, DataTableColumn} from "@terreno/ui/Common";
import {DataTable} from "@terreno/ui/DataTable";
import {ThemeProvider} from "@terreno/ui/Theme";

const DEFAULT_SAMPLE_COUNT = 21;
const DEFAULT_WARMUP_COUNT = 2;
const DEFAULT_TABLE_ROW_COUNT = 1000;
const TABLE_COLUMN_COUNT = 8;
const ROW_TEST_ID_BASE = "bench-table.row";
const VIEWPORT_BOUNDED_ROW_THRESHOLD = 80;

const TABLE_COLUMNS: DataTableColumn[] = Array.from(
  {length: TABLE_COLUMN_COUNT},
  (_, columnIndex): DataTableColumn => ({
    columnType: columnIndex === TABLE_COLUMN_COUNT - 1 ? "boolean" : "text",
    sortable: columnIndex === 0,
    title: `Column ${columnIndex + 1}`,
    width: 120,
  })
);

const createTableData = ({size}: {size: number}): DataTableCellData[][] => {
  return Array.from({length: size}, (_, rowIndex): DataTableCellData[] =>
    TABLE_COLUMNS.map((column, columnIndex): DataTableCellData => {
      if (column.columnType === "boolean") {
        return {value: rowIndex % 2 === 0};
      }

      return {
        value: `Row ${rowIndex + 1}, column ${columnIndex + 1}`,
      };
    })
  );
};

interface TableDataPair {
  baseline: DataTableCellData[][];
  changed: DataTableCellData[][];
}

const tableDataBySize = new Map<number, TableDataPair>();

const getTableData = (size: number): TableDataPair => {
  const cachedData = tableDataBySize.get(size);
  if (cachedData) {
    return cachedData;
  }

  const baseline = createTableData({size});
  const changed = [
    [{value: "Changed value"}, ...baseline[0].slice(1)],
    ...baseline.slice(1),
  ];
  const dataPair = {baseline, changed};
  tableDataBySize.set(size, dataPair);
  return dataPair;
};

const countMountedRowTestIDs = (renderer: ReactTestRenderer): number => {
  const rowTestIdPattern = new RegExp(`^${ROW_TEST_ID_BASE.replace(".", "\\.")}-\\d+$`);
  const uniqueRowTestIds = new Set(
    renderer.root
      .findAll(
        (node: ReactTestInstance) =>
          typeof node.props.testID === "string" && rowTestIdPattern.test(node.props.testID)
      )
      .map((node: ReactTestInstance) => node.props.testID as string)
  );
  return uniqueRowTestIds.size;
};

interface BenchmarkResult {
  changedUpdateMs: number;
  initialRenderMs: number;
  mountedRowCount: number;
  name: string;
  pinnedColumns: number;
  samePropsUpdateMs: number;
  workloadSize: number;
}

interface WorkloadProps {
  pinnedColumns: number;
  revision: number;
  size: number;
}

export const DataTableVirtualizationExampleRenderer: React.FC<WorkloadProps> = ({
  pinnedColumns,
  revision,
  size,
}) => {
  const {baseline, changed} = getTableData(size);

  return (
    <ThemeProvider>
      <DataTable
        columns={TABLE_COLUMNS}
        data={revision === 0 ? baseline : changed}
        getRowTestID={(_, rowIndex) => rowIndex}
        pinnedColumns={pinnedColumns}
        testID="bench-table"
        testIDs={{row: ROW_TEST_ID_BASE}}
      />
    </ThemeProvider>
  );
};

const median = (values: number[]): number => {
  const sortedValues = [...values].sort((left, right) => left - right);
  return sortedValues[Math.floor(sortedValues.length / 2)];
};

const measure = (callback: () => void): number => {
  const startedAt = performance.now();
  callback();
  return performance.now() - startedAt;
};

const renderWithAct = (element: React.ReactElement): ReactTestRenderer => {
  let renderer: ReactTestRenderer | undefined;
  act((): void => {
    renderer = create(element);
  });
  assert.exists(renderer);
  return renderer;
};

const benchmarkWorkload = ({
  Component,
  name,
  pinnedColumns,
  sampleCount,
  size,
  warmupCount,
}: {
  Component: React.FC<WorkloadProps>;
  name: string;
  pinnedColumns: number;
  sampleCount: number;
  size: number;
  warmupCount: number;
}): BenchmarkResult => {
  const initialRenderSamples: number[] = [];
  const samePropsUpdateSamples: number[] = [];
  const changedUpdateSamples: number[] = [];
  const mountedRowCountSamples: number[] = [];
  const totalRuns = warmupCount + sampleCount;

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    let renderer: ReactTestRenderer | undefined;
    const initialRenderMs = measure((): void => {
      renderer = renderWithAct(<Component pinnedColumns={pinnedColumns} revision={0} size={size} />);
    });
    assert.exists(renderer);
    mountedRowCountSamples.push(countMountedRowTestIDs(renderer));

    const samePropsUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<Component pinnedColumns={pinnedColumns} revision={0} size={size} />);
      });
    });
    const changedUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<Component pinnedColumns={pinnedColumns} revision={1} size={size} />);
      });
    });
    act((): void => {
      renderer?.unmount();
    });

    if (runIndex >= warmupCount) {
      initialRenderSamples.push(initialRenderMs);
      samePropsUpdateSamples.push(samePropsUpdateMs);
      changedUpdateSamples.push(changedUpdateMs);
    }
  }

  return {
    changedUpdateMs: median(changedUpdateSamples),
    initialRenderMs: median(initialRenderSamples),
    mountedRowCount: median(mountedRowCountSamples),
    name,
    pinnedColumns,
    samePropsUpdateMs: median(samePropsUpdateSamples),
    workloadSize: size,
  };
};

describe.skipIf(process.env.RUN_UI_DATATABLE_VIRTUAL_BENCHMARK !== "1")(
  "DataTable virtualization performance benchmark",
  () => {
    it(
      "measures large pinned and unpinned DataTable workloads",
      () => {
        const sampleCount = Number(
          process.env.UI_DATATABLE_VIRTUAL_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT
        );
        const warmupCount = Number(
          process.env.UI_DATATABLE_VIRTUAL_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT
        );
        const tableRowCount = Number(
          process.env.UI_DATATABLE_VIRTUAL_BENCHMARK_ROWS ?? DEFAULT_TABLE_ROW_COUNT
        );

        const results = [
          benchmarkWorkload({
            Component: DataTableVirtualizationExampleRenderer,
            name: "DataTable unpinned",
            pinnedColumns: 0,
            sampleCount,
            size: tableRowCount,
            warmupCount,
          }),
          benchmarkWorkload({
            Component: DataTableVirtualizationExampleRenderer,
            name: "DataTable pinned",
            pinnedColumns: 2,
            sampleCount,
            size: tableRowCount,
            warmupCount,
          }),
        ];

        console.info(`UI_DATATABLE_VIRTUAL_BENCHMARK_RESULTS=${JSON.stringify(results)}`);
        assert.lengthOf(results, 2);
        for (const result of results) {
          assert.isAtLeast(result.initialRenderMs, 0);
          assert.isAtLeast(result.samePropsUpdateMs, 0);
          assert.isAtLeast(result.changedUpdateMs, 0);
          assert.isAtLeast(result.mountedRowCount, 0);
        }
      },
      300_000
    );
  }
);

export const DATA_TABLE_VIEWPORT_BOUNDED_ROW_THRESHOLD = VIEWPORT_BOUNDED_ROW_THRESHOLD;