import {assert} from "chai";
import React, {useEffect} from "react";
import {act, create, type ReactTestRenderer} from "react-test-renderer";

import {Box} from "../src/Box";
import {Heading} from "../src/Heading";
import {MarkdownView} from "../src/MarkdownView";
import {Text} from "../src/Text";
import {ThemeProvider, useTheme} from "../src/Theme";

const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 2;
const DEFAULT_WORKLOAD_SIZE = 500;
const MARKDOWN_DIVISOR = 5;
const MARKDOWN_MINIMUM = 100;

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

interface ThemeDriverProps {
  revision: number;
}

const createItems = ({
  renderItem,
  size,
}: {
  renderItem: (index: number) => React.ReactElement;
  size: number;
}): React.ReactElement[] => {
  return Array.from({length: size}, (_, index) => renderItem(index));
};

const BoxWorkload: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {createItems({
        renderItem: (index): React.ReactElement => (
          <Box
            border="default"
            color={revision % 2 === 0 ? "base" : "baseAlternate"}
            direction="row"
            gap={2}
            key={index}
            padding={revision % 2 === 0 ? 2 : 3}
            rounding="md"
          />
        ),
        size,
      })}
    </ThemeProvider>
  );
};

const TextWorkload: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {createItems({
        renderItem: (index): React.ReactElement => (
          <Text
            bold={revision % 2 === 1}
            color={revision % 2 === 0 ? "primary" : "secondaryDark"}
            key={index}
            skipLinking
          >
            {`Text ${index}`}
          </Text>
        ),
        size,
      })}
    </ThemeProvider>
  );
};

const HeadingWorkload: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {createItems({
        renderItem: (index): React.ReactElement => (
          <Heading
            color={revision % 2 === 0 ? "primary" : "secondaryDark"}
            key={index}
            size={revision % 2 === 0 ? "md" : "lg"}
          >
            {`Heading ${index}`}
          </Heading>
        ),
        size,
      })}
    </ThemeProvider>
  );
};

const MarkdownWorkload: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {createItems({
        renderItem: (index): React.ReactElement => (
          <MarkdownView inverted={revision % 2 === 1} key={index}>
            {`## Item ${index}\n\nBody with **bold** text and a [link](https://example.com).`}
          </MarkdownView>
        ),
        size,
      })}
    </ThemeProvider>
  );
};

const ThemeDriver: React.FC<ThemeDriverProps> = ({revision}) => {
  const {setPrimitives} = useTheme();

  // Trigger a real provider update so the benchmark includes context fan-out.
  useEffect((): void => {
    setPrimitives({neutral000: revision % 2 === 0 ? "#FFFFFF" : "#FEFEFE"});
  }, [revision, setPrimitives]);

  return null;
};

const ThemeProbe: React.FC = () => {
  const {theme} = useTheme();
  return React.createElement("ThemeProbe", {color: theme.surface.base});
};

const ThemeWorkload: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      <ThemeDriver revision={revision} />
      {createItems({
        renderItem: (index): React.ReactElement => <ThemeProbe key={index} />,
        size,
      })}
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

describe.skipIf(process.env.RUN_UI_P0_BENCHMARK !== "1")("P0 render performance benchmark", () => {
  it(
    "measures large primitive and theme workloads",
    () => {
      const sampleCount = Number(process.env.UI_P0_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT);
      const warmupCount = Number(process.env.UI_P0_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT);
      const workloadSize = Number(process.env.UI_P0_BENCHMARK_SIZE ?? DEFAULT_WORKLOAD_SIZE);
      const markdownSize = Math.max(
        MARKDOWN_MINIMUM,
        Math.floor(workloadSize / MARKDOWN_DIVISOR)
      );

      const results = [
        benchmarkWorkload({
          Component: BoxWorkload,
          name: "Box",
          sampleCount,
          size: workloadSize,
          warmupCount,
        }),
        benchmarkWorkload({
          Component: TextWorkload,
          name: "Text",
          sampleCount,
          size: workloadSize,
          warmupCount,
        }),
        benchmarkWorkload({
          Component: HeadingWorkload,
          name: "Heading",
          sampleCount,
          size: workloadSize,
          warmupCount,
        }),
        benchmarkWorkload({
          Component: MarkdownWorkload,
          name: "MarkdownView",
          sampleCount,
          size: markdownSize,
          warmupCount,
        }),
        benchmarkWorkload({
          Component: ThemeWorkload,
          name: "ThemeContext",
          sampleCount,
          size: workloadSize,
          warmupCount,
        }),
      ];

      console.info(`UI_P0_BENCHMARK_RESULTS=${JSON.stringify(results)}`);
      assert.lengthOf(results, 5);
      for (const result of results) {
        assert.isAtLeast(result.initialRenderMs, 0);
        assert.isAtLeast(result.samePropsUpdateMs, 0);
        assert.isAtLeast(result.changedUpdateMs, 0);
      }
    },
    120_000
  );
});
