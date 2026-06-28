import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {NOOP_PROVIDER, OpenFeature} from "@openfeature/web-sdk";
import {renderHook, waitFor} from "@testing-library/react-native";

import {resolveFeatureFlagsOptions, useFeatureFlags} from "./useFeatureFlags";

type TerrenoFlagConfiguration = Record<
  string,
  {
    defaultVariant: string;
    disabled: boolean;
    variants: Record<string, boolean | string>;
  }
>;

type QueryResult = {
  data?: TerrenoFlagConfiguration;
  error?: unknown;
  isFetching?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
};

describe("resolveFeatureFlagsOptions", () => {
  it("applies defaults when no argument is provided", () => {
    expect(resolveFeatureFlagsOptions()).toEqual({
      basePath: "/feature-flags",
      domain: "feature-flags",
      skip: false,
    });
  });

  it("applies defaults when an empty options object is provided", () => {
    expect(resolveFeatureFlagsOptions({})).toEqual({
      basePath: "/feature-flags",
      domain: "feature-flags",
      skip: false,
    });
  });

  it("treats a string argument as a legacy basePath with skip=false", () => {
    expect(resolveFeatureFlagsOptions("/custom-path")).toEqual({
      basePath: "/custom-path",
      domain: "feature-flags",
      skip: false,
    });
  });

  it("preserves an empty string basePath when passed as a legacy string argument", () => {
    expect(resolveFeatureFlagsOptions("")).toEqual({
      basePath: "",
      domain: "feature-flags",
      skip: false,
    });
  });

  it("uses options.basePath when provided", () => {
    expect(resolveFeatureFlagsOptions({basePath: "/flags"})).toEqual({
      basePath: "/flags",
      domain: "feature-flags",
      skip: false,
    });
  });

  it("uses options.skip when provided", () => {
    expect(resolveFeatureFlagsOptions({skip: true})).toEqual({
      basePath: "/feature-flags",
      domain: "feature-flags",
      skip: true,
    });
  });

  it("uses both options.basePath and options.skip when provided together", () => {
    expect(resolveFeatureFlagsOptions({basePath: "/flags", skip: true})).toEqual({
      basePath: "/flags",
      domain: "feature-flags",
      skip: true,
    });
  });

  it("does not let a legacy string basePath override skip to true", () => {
    expect(resolveFeatureFlagsOptions("/custom-path").skip).toBe(false);
  });
});

const boolDef = (variant: "on" | "off") => ({
  defaultVariant: variant,
  disabled: false,
  variants: {off: false, on: true},
});

const buildApi = (queryResult: QueryResult) => {
  const refetch = mock(() => {});
  const capturedQueryBuilder: Array<{method: string; url: string}> = [];
  const useTerrenoFlagConfigurationQuery = mock(() => {
    const hasData = Boolean(queryResult.data);
    return {
      data: queryResult.data,
      error: queryResult.error,
      isFetching: queryResult.isFetching ?? false,
      isLoading: queryResult.isLoading ?? false,
      isSuccess: queryResult.isSuccess ?? hasData,
      refetch,
    };
  });
  const api = {
    injectEndpoints: mock((opts: {endpoints: (builder: unknown) => void}) => {
      const builder = {
        query: (def: {query: () => {method: string; url: string}}) => {
          capturedQueryBuilder.push(def.query());
          return {useQuery: useTerrenoFlagConfigurationQuery};
        },
      };
      opts.endpoints(builder);
      return {useTerrenoFlagConfigurationQuery};
    }),
  };
  return {api, capturedQueryBuilder, refetch, useTerrenoFlagConfigurationQuery};
};

describe("useFeatureFlags hook", () => {
  const debugCalls: unknown[][] = [];
  const originalDebug = console.debug;

  beforeEach(async () => {
    debugCalls.length = 0;
    console.debug = (...args: unknown[]): void => {
      debugCalls.push(args);
    };
    await OpenFeature.setProviderAndWait("feature-flags", NOOP_PROVIDER);
  });

  afterEach(async () => {
    console.debug = originalDebug;
    await OpenFeature.setProviderAndWait("feature-flags", NOOP_PROVIDER);
  });

  it("builds the flagConfiguration endpoint with the default basePath", () => {
    const {api, capturedQueryBuilder} = buildApi({data: {foo: boolDef("on")}});
    renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {
        userId: "u1",
      })
    );
    expect(capturedQueryBuilder[0]).toEqual({
      method: "GET",
      url: "/feature-flags/flagConfiguration",
    });
  });

  it("builds the flagConfiguration endpoint with a custom basePath from legacy string argument", () => {
    const {api, capturedQueryBuilder} = buildApi({data: {foo: boolDef("on")}});
    renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], "/flags")
    );
    expect(capturedQueryBuilder[0]).toEqual({method: "GET", url: "/flags/flagConfiguration"});
  });

  it("projects FlagConfiguration to flat flags like the legacy /evaluate map", async () => {
    const {api} = buildApi({
      data: {
        b1: boolDef("on"),
        v1: {
          defaultVariant: "compact",
          disabled: false,
          variants: {compact: "compact", detailed: "detailed"},
        },
      },
    });
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {userId: "u1"})
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.flags).toEqual({
      b1: true,
      v1: "compact",
    });
  });

  it("returns flag accessors that read boolean and string values", async () => {
    const {api} = buildApi({
      data: {
        booleanOff: boolDef("off"),
        booleanOn: boolDef("on"),
        variantFlag: {
          defaultVariant: "variant-a",
          disabled: false,
          variants: {compact: "compact", detailed: "detailed", "variant-a": "variant-a"},
        },
      },
    });
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {userId: "u1"})
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.getFlag("booleanOn")).toBe(true);
    expect(result.current.getFlag("booleanOff")).toBe(false);
    expect(result.current.getFlag("variantFlag")).toBe(false);
    expect(result.current.getVariant("variantFlag")).toBe("variant-a");
    expect(result.current.getVariant("booleanOn")).toBeNull();
    expect(result.current.getVariant("missing")).toBeNull();
  });

  it("returns an empty flags map when no data is available", () => {
    const {api} = buildApi({isLoading: true, isSuccess: false});
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {userId: "u1"})
    );
    expect(result.current.flags).toEqual({});
    expect(result.current.isLoading).toBe(true);
  });

  it("exposes refetch from the underlying query hook", async () => {
    const {api, refetch} = buildApi({data: {foo: boolDef("on")}});
    const {result} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {userId: "u1"})
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    result.current.refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it("logs flagConfiguration request started when loading begins without prior data", () => {
    const {api} = buildApi({isLoading: true, isSuccess: false});
    renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {userId: "u1"})
    );
    const started = debugCalls.find(
      (args) => args[0] === "[feature-flags] flagConfiguration request started"
    );
    expect(started).toBeDefined();
  });

  it("logs flagConfiguration request completed when data resolves after a loading phase", async () => {
    const api = buildApi({isLoading: true, isSuccess: false});
    const {rerender} = renderHook(
      ({queryResult}: {queryResult: QueryResult}) => {
        api.useTerrenoFlagConfigurationQuery.mockImplementationOnce(() => ({
          data: queryResult.data,
          error: queryResult.error,
          isFetching: queryResult.isFetching ?? false,
          isLoading: queryResult.isLoading ?? false,
          isSuccess: queryResult.isSuccess ?? Boolean(queryResult.data),
          refetch: api.refetch,
        }));
        return useFeatureFlags(api.api as unknown as Parameters<typeof useFeatureFlags>[0], {
          userId: "u1",
        });
      },
      {initialProps: {queryResult: {isLoading: true, isSuccess: false}}}
    );
    rerender({queryResult: {data: {alpha: boolDef("on")}, isLoading: false, isSuccess: true}});
    await waitFor(() => {
      const completed = debugCalls.find(
        (args) => args[0] === "[feature-flags] flagConfiguration request completed"
      );
      expect(completed).toBeDefined();
    });
    const started = debugCalls.find(
      (args) => args[0] === "[feature-flags] flagConfiguration request started"
    );
    expect(started).toBeDefined();
  });

  it("injects the flagConfiguration endpoint only once per (api, basePath)", () => {
    let injectCallCount = 0;
    const refetch = mock(() => {});
    const useTerrenoFlagConfigurationQuery = mock(() => ({
      data: {},
      error: undefined,
      isFetching: false,
      isLoading: false,
      isSuccess: true,
      refetch,
    }));
    const api = {
      injectEndpoints: () => {
        injectCallCount += 1;
        return {useTerrenoFlagConfigurationQuery};
      },
    };
    const {rerender} = renderHook(() =>
      useFeatureFlags(api as unknown as Parameters<typeof useFeatureFlags>[0], {userId: "u1"})
    );
    rerender(undefined);
    rerender(undefined);
    expect(injectCallCount).toBe(1);
  });

  it("logs flagConfiguration request failed when error is returned after loading", () => {
    const api = buildApi({isLoading: true, isSuccess: false});
    const {rerender} = renderHook(
      ({queryResult}: {queryResult: QueryResult}) => {
        api.useTerrenoFlagConfigurationQuery.mockImplementationOnce(() => ({
          data: queryResult.data,
          error: queryResult.error,
          isFetching: queryResult.isFetching ?? false,
          isLoading: queryResult.isLoading ?? false,
          isSuccess: queryResult.isSuccess ?? false,
          refetch: api.refetch,
        }));
        return useFeatureFlags(api.api as unknown as Parameters<typeof useFeatureFlags>[0], {
          userId: "u1",
        });
      },
      {initialProps: {queryResult: {isLoading: true, isSuccess: false}}}
    );
    rerender({queryResult: {error: new Error("boom"), isLoading: false, isSuccess: false}});
    const failed = debugCalls.find(
      (args) => args[0] === "[feature-flags] flagConfiguration request failed"
    );
    expect(failed).toBeDefined();
  });
});
