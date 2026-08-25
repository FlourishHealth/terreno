import {assert} from "chai";
import React from "react";
import {act, create, type ReactTestRenderer} from "react-test-renderer";

import {Button} from "@terreno/ui/Button";
import {ThemeProvider} from "@terreno/ui/Theme";

const DEFAULT_BUTTON_COUNT = 500;
const DEFAULT_CONFIRMATION_BUTTON_COUNT = 100;
const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 2;

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

const handlePress = async (): Promise<void> => {};

export const P2PlainButtonExampleRenderer: React.FC<WorkloadProps> = ({revision, size}) => {
  return (
    <ThemeProvider>
      {Array.from({length: size}, (_, index): React.ReactElement => (
        <Button
          key={index}
          onClick={handlePress}
          text={revision === 0 || index > 0 ? `Action ${index}` : "Changed action"}
        />
      ))}
    </ThemeProvider>
  );
};

export const P2ConfirmationButtonExampleRenderer: React.FC<WorkloadProps> = ({
  revision,
  size,
}) => {
  return (
    <ThemeProvider>
      {Array.from({length: size}, (_, index): React.ReactElement => (
        <Button
          confirmationText={
            revision === 0 || index > 0 ? `Confirm action ${index}?` : "Confirm changed action?"
          }
          key={index}
          onClick={handlePress}
          text={`Confirm ${index}`}
          withConfirmation
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

describe.skipIf(process.env.RUN_UI_P2_BUTTON_BENCHMARK !== "1")(
  "P2 Button render performance benchmark",
  () => {
    it(
      "measures plain and confirmation Button example renderers",
      () => {
        const sampleCount = Number(
          process.env.UI_P2_BUTTON_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT
        );
        const warmupCount = Number(
          process.env.UI_P2_BUTTON_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT
        );
        const buttonCount = Number(
          process.env.UI_P2_BUTTON_BENCHMARK_SIZE ?? DEFAULT_BUTTON_COUNT
        );
        const confirmationButtonCount = Number(
          process.env.UI_P2_CONFIRMATION_BUTTON_BENCHMARK_SIZE ??
            DEFAULT_CONFIRMATION_BUTTON_COUNT
        );

        const results = [
          benchmarkWorkload({
            Component: P2PlainButtonExampleRenderer,
            name: "Plain Button",
            sampleCount,
            size: buttonCount,
            warmupCount,
          }),
          benchmarkWorkload({
            Component: P2ConfirmationButtonExampleRenderer,
            name: "Confirmation Button",
            sampleCount,
            size: confirmationButtonCount,
            warmupCount,
          }),
        ];

        console.info(`UI_P2_BUTTON_BENCHMARK_RESULTS=${JSON.stringify(results)}`);
        assert.lengthOf(results, 2);
        for (const result of results) {
          assert.isAtLeast(result.initialRenderMs, 0);
          assert.isAtLeast(result.samePropsUpdateMs, 0);
          assert.isAtLeast(result.changedUpdateMs, 0);
        }
      },
      120_000
    );
  }
);
