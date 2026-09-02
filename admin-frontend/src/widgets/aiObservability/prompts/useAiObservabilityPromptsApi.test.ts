import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import {assert} from "chai";
import type {AdminApi, EndpointBuilder} from "../../../types";
import {useAiObservabilityPromptsApi} from "./useAiObservabilityPromptsApi";

interface CapturedEndpoint {
  invalidatesTags?: unknown;
  providesTags?: unknown;
  query: (arg: never) => {body?: unknown; method: string; params?: unknown; url: string};
}

const createApiDouble = () => {
  const endpoints: Record<string, CapturedEndpoint> = {};
  const addTagTypes: string[][] = [];
  const api = {
    enhanceEndpoints: ({addTagTypes: tags}: {addTagTypes: string[]}) => {
      addTagTypes.push(tags);
      return api;
    },
    injectEndpoints: ({
      endpoints: build,
    }: {
      endpoints: (builder: EndpointBuilder) => Record<string, CapturedEndpoint>;
    }) => {
      const builder = {
        mutation: (spec: CapturedEndpoint) => spec,
        query: (spec: CapturedEndpoint) => spec,
      } as unknown as EndpointBuilder;
      Object.assign(endpoints, build(builder));
      return {
        useAiObservabilityPromptQuery: mock(() => ({isLoading: false})),
        useAiObservabilityPromptsQuery: mock(() => ({isLoading: false})),
        useCreateAiObservabilityPromptMutation: mock(() => [mock(() => ({})), {}]),
        useCreateAiObservabilityPromptVersionMutation: mock(() => [mock(() => ({})), {}]),
        useMoveAiObservabilityPromptLabelMutation: mock(() => [mock(() => ({})), {}]),
        useRunAiObservabilityPlaygroundMutation: mock(() => [mock(() => ({})), {}]),
      };
    },
  } as unknown as AdminApi;
  return {addTagTypes, api, endpoints};
};

describe("useAiObservabilityPromptsApi", () => {
  it("injects prompt library, version, label, and playground routes", () => {
    const {addTagTypes, api, endpoints} = createApiDouble();
    renderHook(() => useAiObservabilityPromptsApi(api));

    assert.deepEqual(addTagTypes[0], ["aiObservabilityPrompts"]);
    expect(endpoints.aiObservabilityPrompts.query({include: "usage"} as never)).toEqual({
      method: "GET",
      params: {include: "usage"},
      url: "/ai/observability/prompts",
    });
    expect(endpoints.aiObservabilityPrompt.query("summarize" as never)).toEqual({
      method: "GET",
      url: "/ai/observability/prompts/summarize",
    });
    expect(endpoints.createAiObservabilityPrompt.query({name: "summarize"} as never)).toEqual({
      body: {name: "summarize"},
      method: "POST",
      url: "/ai/observability/prompts",
    });
    expect(
      endpoints.createAiObservabilityPromptVersion.query({
        body: {template: "hi"},
        name: "summarize",
      } as never)
    ).toEqual({
      body: {template: "hi"},
      method: "POST",
      url: "/ai/observability/prompts/summarize/versions",
    });
    expect(
      endpoints.moveAiObservabilityPromptLabel.query({
        label: "production",
        name: "summarize",
        version: 2,
      } as never)
    ).toEqual({
      body: {label: "production", version: 2},
      method: "POST",
      url: "/ai/observability/prompts/summarize/labels",
    });
    expect(
      endpoints.runAiObservabilityPlayground.query({
        name: "summarize",
        variables: {text: "hi"},
        version: 1,
      } as never)
    ).toEqual({
      body: {variables: {text: "hi"}, version: 1},
      method: "POST",
      url: "/ai/observability/prompts/summarize/playground",
    });
  });

  it("exposes prompt hooks for screens", () => {
    const {api} = createApiDouble();
    const {result} = renderHook(() => useAiObservabilityPromptsApi(api));
    expect(typeof result.current.useListQuery).toBe("function");
    expect(typeof result.current.useDetailQuery).toBe("function");
    expect(typeof result.current.useCreateMutation).toBe("function");
    expect(typeof result.current.useCreateVersionMutation).toBe("function");
    expect(typeof result.current.useSetLabelMutation).toBe("function");
    expect(typeof result.current.usePlaygroundMutation).toBe("function");
  });
});
