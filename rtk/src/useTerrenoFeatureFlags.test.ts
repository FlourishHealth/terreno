import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import EventEmitter from "node:events";
import {NOOP_PROVIDER, OpenFeature} from "@openfeature/web-sdk";
import {renderHook, waitFor} from "@testing-library/react-native";
import React, {StrictMode} from "react";

import {useTerrenoFeatureFlags} from "./useTerrenoFeatureFlags";

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
  isError?: boolean;
  isFetching?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
};

const boolDef = (variant: "on" | "off") => ({
  defaultVariant: variant,
  disabled: false,
  variants: {off: false, on: true},
});

const buildApi = (queryResult: QueryResult) => {
  const refetch = mock(() => {});
  const useTerrenoFlagConfigurationQuery = mock(() => {
    const hasData = Boolean(queryResult.data);
    return {
      data: queryResult.data,
      error: queryResult.error,
      isError: queryResult.isError ?? Boolean(queryResult.error),
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
          def.query();
          return {useQuery: useTerrenoFlagConfigurationQuery};
        },
      };
      opts.endpoints(builder);
      return {useTerrenoFlagConfigurationQuery};
    }),
  };
  return {api, refetch, useTerrenoFlagConfigurationQuery};
};

describe("useTerrenoFeatureFlags", () => {
  beforeEach(async () => {
    await OpenFeature.setProviderAndWait("feature-flags", NOOP_PROVIDER);
    await OpenFeature.setProviderAndWait("custom-ff", NOOP_PROVIDER);
  });

  afterEach(async () => {
    await OpenFeature.setProviderAndWait("feature-flags", NOOP_PROVIDER);
    await OpenFeature.setProviderAndWait("custom-ff", NOOP_PROVIDER);
  });

  it("sets TypedInMemoryProvider and exposes client values after success", async () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    const {result} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: "feature-flags", userId: "u1"})
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.client.getBooleanValue("alpha", false)).toBe(true);
    expect(result.current.flags.alpha?.defaultVariant).toBe("on");
  });

  it("does not leave loading stuck when skip is true", () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    const {result} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: "feature-flags", skip: true, userId: "u1"})
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("does not leave loading stuck when the flag configuration query errors", () => {
    const {api} = buildApi({
      error: new Error("request failed"),
      isError: true,
      isLoading: false,
      isSuccess: false,
    });
    const {result} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: "feature-flags", userId: "u1"})
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeDefined();
  });

  it("isolates domains so a custom domain does not read another domain's provider", async () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    const {result} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: "custom-ff", userId: "u1"})
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const defaultClient = OpenFeature.getClient();
    expect(defaultClient.getBooleanValue("alpha", false)).toBe(false);
    expect(result.current.client.getBooleanValue("alpha", false)).toBe(true);
  });

  it("refetches when the socket receives the configured event", async () => {
    const socket = new EventEmitter();
    const {api, refetch} = buildApi({data: {alpha: boolDef("off")}});
    const {result} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {
        domain: "feature-flags",
        socket: {
          off: (ev, fn) => {
            socket.off(ev, fn);
          },
          on: (ev, fn) => {
            socket.on(ev, fn);
          },
        },
        socketEventName: "featureFlagsChanged",
        userId: "u1",
      })
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    socket.emit("featureFlagsChanged");
    expect(refetch).toHaveBeenCalled();
  });

  it("survives React StrictMode double-mount without throwing", async () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    const {result} = renderHook(
      () => useTerrenoFeatureFlags(api as never, {domain: "feature-flags", userId: "u1"}),
      {
        wrapper: ({children}: {children: React.ReactNode}) =>
          React.createElement(StrictMode, null, children),
      }
    );
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.client.getBooleanValue("alpha", false)).toBe(true);
  });

  it("re-applies provider when fetched configuration changes", async () => {
    const built = buildApi({data: {alpha: boolDef("off")}});
    const {result, rerender} = renderHook(
      ({data}: {data: TerrenoFlagConfiguration}) => {
        built.useTerrenoFlagConfigurationQuery.mockImplementation(() => ({
          data,
          error: undefined,
          isError: false,
          isFetching: false,
          isLoading: false,
          isSuccess: true,
          refetch: built.refetch,
        }));
        return useTerrenoFeatureFlags(built.api as never, {domain: "feature-flags", userId: "u1"});
      },
      {initialProps: {data: {alpha: boolDef("off")}}}
    );
    await waitFor(() => {
      expect(result.current.client.getBooleanValue("alpha", false)).toBe(false);
    });
    rerender({data: {alpha: boolDef("on")}});
    await waitFor(() => {
      expect(result.current.client.getBooleanValue("alpha", false)).toBe(true);
    });
  });
});

describe("useTerrenoFeatureFlags ref-count cleanup", () => {
  /** Dedicated domain so parallel test files do not hold extra `feature-flags` hook refs. */
  const refcountTestDomain = "terreno-refcount-test-isolation";

  beforeEach(async () => {
    await OpenFeature.setProviderAndWait(refcountTestDomain, NOOP_PROVIDER);
  });

  afterEach(async () => {
    await OpenFeature.setProviderAndWait(refcountTestDomain, NOOP_PROVIDER);
  });

  it("awaits pending provider switch during cleanup when unmount overlaps setProviderAndWait", async () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    // Render and immediately unmount before the provider switch resolves.
    // This exercises the `await pending` path (line 119) in the cleanup.
    const {unmount} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: refcountTestDomain, userId: "u-fast"})
    );
    // Unmount immediately — cleanup fires while the provider switch is still in-flight
    unmount();
    // Allow microtasks (the pending await + NOOP install) to settle
    await new Promise((r) => setTimeout(r, 200));
    // After cleanup the domain should have fallen back to NOOP
    expect(OpenFeature.getClient(refcountTestDomain).getBooleanValue("alpha", false)).toBe(false);
  });

  it("installs NOOP provider after the last hook instance unmounts", async () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    const {unmount} = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: refcountTestDomain, userId: "u1"})
    );
    await waitFor(
      () => {
        expect(OpenFeature.getClient(refcountTestDomain).getBooleanValue("alpha", false)).toBe(
          true
        );
      },
      {timeout: 5000}
    );
    unmount();
    await waitFor(
      () => {
        expect(OpenFeature.getClient(refcountTestDomain).getBooleanValue("alpha", false)).toBe(
          false
        );
      },
      {timeout: 5000}
    );
  });

  it("keeps the provider installed while another hook instance is still mounted", async () => {
    const {api} = buildApi({data: {alpha: boolDef("on")}});
    // Two instances share the domain, so the ref count reaches 2.
    const first = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: refcountTestDomain, userId: "u1"})
    );
    const second = renderHook(() =>
      useTerrenoFeatureFlags(api as never, {domain: refcountTestDomain, userId: "u1"})
    );
    await waitFor(
      () => {
        expect(OpenFeature.getClient(refcountTestDomain).getBooleanValue("alpha", false)).toBe(
          true
        );
      },
      {timeout: 5000}
    );
    // Unmounting one instance decrements the ref count to 1 (the else branch),
    // so the provider must remain installed rather than falling back to NOOP.
    first.unmount();
    await new Promise((r) => setTimeout(r, 200));
    expect(OpenFeature.getClient(refcountTestDomain).getBooleanValue("alpha", false)).toBe(true);
    second.unmount();
  });
});
