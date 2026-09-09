import {assert} from "chai";
import React from "react";
import {act, create, type ReactTestRenderer} from "react-test-renderer";

import type {DataTableCellData, DataTableColumn} from "@terreno/ui/Common";
import {DataTable} from "@terreno/ui/DataTable";
import {Icon} from "@terreno/ui/Icon";
import {ThemeProvider} from "@terreno/ui/Theme";

const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 2;
const DEFAULT_TABLE_ROW_COUNT = 100;
const DEFAULT_ICON_COUNT = 500;
const TABLE_COLUMN_COUNT = 8;

interface BenchmarkResult {
  changedUpdateMs: number;
  initialRenderMs: number;
  name: string;
  samePropsUpdateMs: number;
  workloadSize: number;
}

interface WorkloadProps {
  revision: number;
  size: number;
}

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

export const P1DataTableExampleRenderer: React.FC<WorkloadProps> = ({revision, size}) => {
  const {baseline, changed} = getTableData(size);

  return (
    <ThemeProvider>
      <DataTable
        columns={TABLE_COLUMNS}
        data={revision === 0 ? baseline : changed}
        pinnedColumns={2}
      />
    </ThemeProvider>
  );
};

export const P1IconExampleRenderer: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {Array.from({length: size}, (_, index): React.ReactElement => (
        <Icon
          color={revision === 0 ? "primary" : "secondaryDark"}
          iconName={revision === 0 || index > 0 ? "check" : "star"}
          key={index}
          size="md"
        />
      ))}
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
  sampleCount,
  size,
  warmupCount,
}: {
  Component: React.FC<WorkloadProps>;
  name: string;
  sampleCount: number;
  size: number;
  warmupCount: number;
}): BenchmarkResult => {
  const initialRenderSamples: number[] = [];
  const samePropsUpdateSamples: number[] = [];
  const changedUpdateSamples: number[] = [];
  const totalRuns = warmupCount + sampleCount;

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    let renderer: ReactTestRenderer | undefined;
    const initialRenderMs = measure((): void => {
      renderer = renderWithAct(<Component revision={0} size={size} />);
    });
    assert.exists(renderer);

    const samePropsUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<Component revision={0} size={size} />);
      });
    });
    const changedUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<Component revision={1} size={size} />);
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
    name,
    samePropsUpdateMs: median(samePropsUpdateSamples),
    workloadSize: size,
  };
};

describe.skipIf(process.env.RUN_UI_P1_BENCHMARK !== "1")("P1 render performance benchmark", () => {
  it(
    "measures large DataTable and Icon example renderers",
    () => {
      const sampleCount = Number(process.env.UI_P1_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT);
      const warmupCount = Number(process.env.UI_P1_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT);
      const tableRowCount = Number(
        process.env.UI_P1_BENCHMARK_TABLE_ROWS ?? DEFAULT_TABLE_ROW_COUNT
      );
      const iconCount = Number(process.env.UI_P1_BENCHMARK_ICONS ?? DEFAULT_ICON_COUNT);

      const results = [
        benchmarkWorkload({
          Component: P1DataTableExampleRenderer,
          name: "DataTable",
          sampleCount,
          size: tableRowCount,
          warmupCount,
        }),
        benchmarkWorkload({
          Component: P1IconExampleRenderer,
          name: "Icon",
          sampleCount,
          size: iconCount,
          warmupCount,
        }),
      ];

      console.info(`UI_P1_BENCHMARK_RESULTS=${JSON.stringify(results)}`);
      assert.lengthOf(results, 2);
      for (const result of results) {
        assert.isAtLeast(result.initialRenderMs, 0);
        assert.isAtLeast(result.samePropsUpdateMs, 0);
        assert.isAtLeast(result.changedUpdateMs, 0);
      }
    },
    120_000
  );
});
