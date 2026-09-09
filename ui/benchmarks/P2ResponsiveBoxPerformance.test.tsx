import {assert} from "chai";
import React from "react";
import {Dimensions} from "react-native";
import {act, create, type ReactTestRenderer} from "react-test-renderer";

import {Box} from "@terreno/ui/Box";
import {ThemeProvider} from "@terreno/ui/Theme";

const DEFAULT_BOX_COUNT = 500;
const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 2;

interface BenchmarkResult {
  changedUpdateMs: number;
  initialDimensionReads: number;
  initialRenderMs: number;
  name: string;
  samePropsUpdateMs: number;
  workloadSize: number;
}

interface WorkloadProps {
  revision: number;
  size: number;
}

export const P2ResponsiveBoxExampleRenderer: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {Array.from({length: size}, (_, index): React.ReactElement => (
        <Box
          direction="column"
          key={index}
          lgDirection="row"
          mdDirection={revision === 0 || index > 0 ? "column" : "row"}
          smDirection="row"
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

const getDimensionReadCount = (): number => {
  const dimensionsGetMock = Dimensions.get as typeof Dimensions.get & {
    mock?: {calls: unknown[][]};
  };
  return dimensionsGetMock.mock?.calls.length ?? 0;
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
  sampleCount,
  size,
  warmupCount,
}: {
  sampleCount: number;
  size: number;
  warmupCount: number;
}): BenchmarkResult => {
  const initialRenderSamples: number[] = [];
  const initialDimensionReadSamples: number[] = [];
  const samePropsUpdateSamples: number[] = [];
  const changedUpdateSamples: number[] = [];
  const totalRuns = warmupCount + sampleCount;

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    let renderer: ReactTestRenderer | undefined;
    const dimensionReadsBeforeRender = getDimensionReadCount();
    const initialRenderMs = measure((): void => {
      renderer = renderWithAct(<P2ResponsiveBoxExampleRenderer revision={0} size={size} />);
    });
    const initialDimensionReads = getDimensionReadCount() - dimensionReadsBeforeRender;
    assert.exists(renderer);

    const samePropsUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<P2ResponsiveBoxExampleRenderer revision={0} size={size} />);
      });
    });
    const changedUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<P2ResponsiveBoxExampleRenderer revision={1} size={size} />);
      });
    });
    act((): void => {
      renderer?.unmount();
    });

    if (runIndex >= warmupCount) {
      initialDimensionReadSamples.push(initialDimensionReads);
      initialRenderSamples.push(initialRenderMs);
      samePropsUpdateSamples.push(samePropsUpdateMs);
      changedUpdateSamples.push(changedUpdateMs);
    }
  }

  return {
    changedUpdateMs: median(changedUpdateSamples),
    initialDimensionReads: median(initialDimensionReadSamples),
    initialRenderMs: median(initialRenderSamples),
    name: "Responsive Box",
    samePropsUpdateMs: median(samePropsUpdateSamples),
    workloadSize: size,
  };
};

describe.skipIf(process.env.RUN_UI_P2_RESPONSIVE_BOX_BENCHMARK !== "1")(
  "P2 responsive Box performance benchmark",
  () => {
    it(
      "measures a large responsive Box tree",
      () => {
        const sampleCount = Number(
          process.env.UI_P2_RESPONSIVE_BOX_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT
        );
        const warmupCount = Number(
          process.env.UI_P2_RESPONSIVE_BOX_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT
        );
        const boxCount = Number(
          process.env.UI_P2_RESPONSIVE_BOX_BENCHMARK_SIZE ?? DEFAULT_BOX_COUNT
        );
        const result = benchmarkWorkload({sampleCount, size: boxCount, warmupCount});

        console.info(`UI_P2_RESPONSIVE_BOX_BENCHMARK_RESULTS=${JSON.stringify([result])}`);
        assert.isAtLeast(result.initialRenderMs, 0);
        assert.isAtMost(result.initialDimensionReads, 2);
        assert.isAtLeast(result.samePropsUpdateMs, 0);
        assert.isAtLeast(result.changedUpdateMs, 0);
      },
      120_000
    );
  }
);
