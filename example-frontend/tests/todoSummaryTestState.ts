import {mock} from "bun:test";

export const todoSummaryTestState: {
  error: unknown;
  output: string;
  todos: Array<{completed: boolean; id: string; text: string}>;
} = {
  error: undefined,
  output: "Two todos remain.",
  todos: [],
};

export const summarizeExampleTextMock = mock((_body: {apiKey?: string; text: string}) => ({
  unwrap: async (): Promise<{output: string}> => {
    if (todoSummaryTestState.error) {
      throw todoSummaryTestState.error;
    }
    return {output: todoSummaryTestState.output};
  },
}));
