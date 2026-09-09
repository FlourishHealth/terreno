import {assert} from "chai";
import React, {useEffect, useState} from "react";
import {act, create, type ReactTestRenderer} from "react-test-renderer";

import type {OpenAPISpec} from "../src/Common";
import {OpenAPIProvider, useOpenAPISpec} from "../src/OpenAPIContext";

const DEFAULT_CONSUMER_COUNT = 500;
const DEFAULT_SAMPLE_COUNT = 7;
const DEFAULT_WARMUP_COUNT = 2;

const SPEC_V0: OpenAPISpec = {
  paths: {
    "/todoItems/": {
      get: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    data: {
                      items: {
                        properties: {
                          title: {description: "Title for the todo", type: "string"},
                        },
                        required: ["title"],
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const SPEC_V1: OpenAPISpec = {
  paths: {
    "/todoItems/": {
      get: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    data: {
                      items: {
                        properties: {
                          title: {description: "Updated title description", type: "string"},
                        },
                        required: ["title"],
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

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

const specByUrl: Record<string, OpenAPISpec> = {
  "https://benchmark.example/openapi-v0.json": SPEC_V0,
  "https://benchmark.example/openapi-v1.json": SPEC_V1,
};

const installFetchMock = (): void => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const spec = specByUrl[url];
    if (!spec) {
      throw new Error(`Unexpected benchmark spec URL: ${url}`);
    }
    return {
      json: async () => spec,
    };
  }) as typeof globalThis.fetch;
};

const ParentDriver: React.FC<{children: React.ReactElement; revision: number}> = ({
  children,
  revision,
}) => {
  const [, setTick] = useState(0);

  // Trigger parent rerenders without changing the loaded OpenAPI spec on revision 0.
  useEffect((): void => {
    setTick(revision);
  }, [revision]);

  return children;
};

const OpenAPIProbe: React.FC<{index: number}> = ({index}) => {
  const {getModelField} = useOpenAPISpec();
  const field = getModelField("Todo Items", "title");
  return React.createElement("OpenAPIProbe", {
    description: field?.description ?? "missing",
    index,
  });
};

export const P0OpenAPIExampleRenderer: React.FC<WorkloadProps> = ({revision, size}) => {
  const specUrl =
    revision === 0
      ? "https://benchmark.example/openapi-v0.json"
      : "https://benchmark.example/openapi-v1.json";

  return (
    <ParentDriver revision={revision}>
      <OpenAPIProvider specUrl={specUrl}>
        {Array.from({length: size}, (_, index): React.ReactElement => (
          <OpenAPIProbe index={index} key={index} />
        ))}
      </OpenAPIProvider>
    </ParentDriver>
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
  sampleCount,
  size,
  warmupCount,
}: {
  sampleCount: number;
  size: number;
  warmupCount: number;
}): BenchmarkResult => {
  const initialRenderSamples: number[] = [];
  const samePropsUpdateSamples: number[] = [];
  const changedUpdateSamples: number[] = [];
  const totalRuns = warmupCount + sampleCount;

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    installFetchMock();
    let renderer: ReactTestRenderer | undefined;
    const initialRenderMs = measure((): void => {
      renderer = renderWithAct(<P0OpenAPIExampleRenderer revision={0} size={size} />);
    });
    assert.exists(renderer);

    const samePropsUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<P0OpenAPIExampleRenderer revision={0} size={size} />);
      });
    });
    const changedUpdateMs = measure((): void => {
      act((): void => {
        renderer?.update(<P0OpenAPIExampleRenderer revision={1} size={size} />);
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
    name: "OpenAPIContext",
    samePropsUpdateMs: median(samePropsUpdateSamples),
    workloadSize: size,
  };
};

describe.skipIf(process.env.RUN_UI_P0_OPENAPI_BENCHMARK !== "1")(
  "P0 OpenAPI context performance benchmark",
  () => {
    it(
      "measures many OpenAPI consumers under equivalent and changed provider updates",
      () => {
        const sampleCount = Number(
          process.env.UI_P0_OPENAPI_BENCHMARK_SAMPLES ?? DEFAULT_SAMPLE_COUNT
        );
        const warmupCount = Number(
          process.env.UI_P0_OPENAPI_BENCHMARK_WARMUPS ?? DEFAULT_WARMUP_COUNT
        );
        const consumerCount = Number(
          process.env.UI_P0_OPENAPI_BENCHMARK_SIZE ?? DEFAULT_CONSUMER_COUNT
        );
        const result = benchmarkWorkload({sampleCount, size: consumerCount, warmupCount});

        console.info(`UI_P0_OPENAPI_BENCHMARK_RESULTS=${JSON.stringify([result])}`);
        assert.isAtLeast(result.initialRenderMs, 0);
        assert.isAtLeast(result.samePropsUpdateMs, 0);
        assert.isAtLeast(result.changedUpdateMs, 0);
      },
      120_000
    );
  }
);
