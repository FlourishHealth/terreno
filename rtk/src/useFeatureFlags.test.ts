import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

import {resolveFeatureFlagsOptions, useFeatureFlags} from "./useFeatureFlags";

type FlagValues = Record<string, boolean | string | null>;
type QueryResult = {
  data?: FlagValues;
  error?: unknown;
  isLoading?: boolean;
};

describe("resolveFeatureFlagsOptions", () => {
  it("applies defaults when no argument is provided", () => {
    expect(resolveFeatureFlagsOptions()).toEqual({
      basePath: "/feature-flags",
      skip: false,
    });
  });

  it("applies defaults when an empty options object is provided", () => {
    expect(resolveFeatureFlagsOptions({})).toEqual({
      basePath: "/feature-flags",
      skip: false,
    });
  });

  it("treats a string argument as a legacy basePath with skip=false", () => {
    expect(resolveFeatureFlagsOptions("/custom-path")).toEqual({
      basePath: "/custom-path",
      skip: false,
    });
  });

  it("preserves an empty string basePath when passed as a legacy string argument", () => {
    expect(resolveFeatureFlagsOptions("")).toEqual({
      basePath: "",
      skip: false,
    });
  });

  it("uses options.basePath when provided", () => {
    expect(resolveFeatureFlagsOptions({basePath: "/flags"})).toEqual({
      basePath: "/flags",
      skip: false,
    });
  });

  it("uses options.skip when provided", () => {
    expect(resolveFeatureFlagsOptions({skip: true})).toEqual({
      basePath: "/feature-flags",
      skip: true,
    });
  });

  it("uses both options.basePath and options.skip when provided together", () => {
    expect(resolveFeatureFlagsOptions({basePath: "/flags", skip: true})).toEqual({
      basePath: "/flags",
      skip: true,
    });
  });

  it("does not let a legacy string basePath override skip to true", () => {
    expect(resolveFeatureFlagsOptions("/custom-path").skip).toBe(false);
  });
});

const buildApi = (queryResult: QueryResult) => {
  const refetch = mock(() => {});
  const capturedQueryBuilder: Array<{method: string; url: string}> = [];
  const useEvaluateFeatureFlagsQuery = mock(() => ({
    data: queryResult.data,
    error: queryResult.error,
    isLoading: queryResult.isLoading ?? false,
    refetch,
  }));
  const api = {
    injectEndpoints: mock((opts: {endpoints: (builder: unknown) => void}) => {
      const builder = {
        query: (def: {query: () => {method: string; url: string}}) => {
          capturedQueryBuilder.push(def.query());
          return {useQuery: useEvaluateFeatureFlagsQuery};
        },
      };
      opts.endpoints(builder);
      return {useEvaluateFeatureFlagsQuery};
    }),
  };
  return {api, capturedQueryBuilder, refetch, useEvaluateFeatureFlagsQuery};
};

describe("useFeatureFlags hook", () => {
  const debugCalls: unknown[][] = [];
  const originalDebug = console.debug;

  beforeEach(() => {
    debugCalls.length = 0;
    console.debug = (...args: unknown[]): void => {
      debugCalls.push(args);
    };
  });

  afterEach(() => {
    console.debug = originalDebug;
  });

  it("builds the evaluate endpoint with the default basePath", () => {
    const {api, capturedQueryBuilder} = buildApi({data: {foo: true}});
    renderHook(() => useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0]));
    expect(capturedQueryBuilder[0]).toEqual({
      method: "GET",
      url: "/feature-flags/evaluate",
    });
  });

  it("builds the evaluate endpoint with a custom basePath from legacy string argument", () => {
    const {api, capturedQueryBuilder} = buildApi({data: {foo: true}});
    renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], "/flags")
    );
    expect(capturedQueryBuilder[0]).toEqual({method: "GET", url: "/flags/evaluate"});
  });

  it("returns flag accessors that read boolean and string values", () => {
    const {api} = buildApi({
      data: {booleanOff: false, booleanOn: true, variantFlag: "variant-a"},
    });
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0])
    );
    expect(result.current.getFlag("booleanOn")).toBe(true);
    expect(result.current.getFlag("booleanOff")).toBe(false);
    expect(result.current.getFlag("variantFlag")).toBe(false);
    expect(result.current.getVariant("variantFlag")).toBe("variant-a");
    expect(result.current.getVariant("booleanOn")).toBeNull();
    expect(result.current.getVariant("missing")).toBeNull();
  });

  it("returns an empty flags map when no data is available", () => {
    const {api} = buildApi({isLoading: true});
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0])
    );
    expect(result.current.flags).toEqual({});
    expect(result.current.isLoading).toBe(true);
  });

  it("exposes refetch from the underlying query hook", () => {
    const {api, refetch} = buildApi({data: {foo: true}});
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0])
    );
    result.current.refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it("logs evaluate request started when loading begins without prior data", () => {
    const {api} = buildApi({isLoading: true});
    renderHook(() => useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0]));
    const started = debugCalls.find(
      (args) => args[0] === "[feature-flags] evaluate request started"
    );
    expect(started).toBeDefined();
  });

  it("logs evaluate request completed when data resolves after a loading phase", () => {
    const api = buildApi({isLoading: true});
    const {rerender} = renderHook(
      ({queryResult}: {queryResult: QueryResult}) => {
        api.useEvaluateFeatureFlagsQuery.mockImplementationOnce(() => ({
          data: queryResult.data,
          error: queryResult.error,
          isLoading: queryResult.isLoading ?? false,
          refetch: api.refetch,
        }));
        return useFeatureFlags(api.api as unknown as Parameters<typeof useFeatureFlags>[0]);
      },
      {initialProps: {queryResult: {isLoading: true}}}
    );
    rerender({queryResult: {data: {alpha: true}, isLoading: false}});
    const completed = debugCalls.find(
      (args) => args[0] === "[feature-flags] evaluate request completed"
    );
    const started = debugCalls.find(
      (args) => args[0] === "[feature-flags] evaluate request started"
    );
    expect(started).toBeDefined();
    expect(completed).toBeDefined();
  });

  it("logs evaluate request failed when error is returned after loading", () => {
    const api = buildApi({isLoading: true});
    const {rerender} = renderHook(
      ({queryResult}: {queryResult: QueryResult}) => {
        api.useEvaluateFeatureFlagsQuery.mockImplementationOnce(() => ({
          data: queryResult.data,
          error: queryResult.error,
          isLoading: queryResult.isLoading ?? false,
          refetch: api.refetch,
        }));
        return useFeatureFlags(api.api as unknown as Parameters<typeof useFeatureFlags>[0]);
      },
      {initialProps: {queryResult: {isLoading: true}}}
    );
    rerender({queryResult: {error: new Error("boom"), isLoading: false}});
    const failed = debugCalls.find((args) => args[0] === "[feature-flags] evaluate request failed");
    expect(failed).toBeDefined();
  });
});
