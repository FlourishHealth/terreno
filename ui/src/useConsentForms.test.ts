import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

import {detectLocale, useConsentForms} from "./useConsentForms";

mock.module("expo-localization", () => ({
  getLocales: () => [{languageTag: "es-ES"}],
}));

describe("detectLocale", () => {
  it("returns locale from expo-localization in native test env", () => {
    const originalNavigator = (globalThis as any).navigator;
    (globalThis as any).navigator = undefined;
    const locale = detectLocale();
    (globalThis as any).navigator = originalNavigator;
    expect(typeof locale).toBe("string");
    expect(locale.length).toBeGreaterThan(0);
  });

  it("falls back to en when expo-localization throws and no navigator", () => {
    const originalNavigator = (globalThis as any).navigator;
    (globalThis as any).navigator = undefined;
    mock.module("expo-localization", () => ({
      getLocales: () => {
        throw new Error("not available");
      },
    }));
    const locale = detectLocale();
    (globalThis as any).navigator = originalNavigator;
    // Reset mock
    mock.module("expo-localization", () => ({
      getLocales: () => [{languageTag: "es-ES"}],
    }));
    expect(locale).toBe("en");
  });

  it("returns navigator.language when available", () => {
    const originalNavigator = (globalThis as any).navigator;
    (globalThis as any).navigator = {language: "fr-FR"};
    const locale = detectLocale();
    (globalThis as any).navigator = originalNavigator;
    expect(locale).toBe("fr-FR");
  });
});

describe("useConsentForms", () => {
  const buildApi = (queryResult: {data?: unknown; error?: unknown; isLoading?: boolean}) => {
    const refetch = mock(() => {});
    const useGetPendingConsentsQuery = mock(() => ({
      data: queryResult.data,
      error: queryResult.error,
      isLoading: queryResult.isLoading ?? false,
      refetch,
    }));
    const api = {
      enhanceEndpoints: mock(() => ({
        injectEndpoints: mock((opts: any) => {
          // Call endpoint builder to exercise provides/onQueryStarted
          const build = {
            query: mock((def: any) => {
              // Call onQueryStarted with a successful result
              if (def.onQueryStarted) {
                void def.onQueryStarted(undefined, {
                  queryFulfilled: Promise.resolve({data: [{id: "1"}]}),
                });
              }
              // Also exercise the URL builder
              def.query();
              return "pending-query";
            }),
          };
          opts.endpoints(build);
          return {useGetPendingConsentsQuery};
        }),
      })),
    };
    return {api, refetch};
  };

  it("returns an array of forms when response is an array", () => {
    const {api} = buildApi({data: [{id: "1", title: "Form 1"} as any]});
    const {result} = renderHook(() => useConsentForms(api as any));
    expect(result.current.forms).toBeDefined();
    expect(Array.isArray(result.current.forms)).toBe(true);
  });

  it("unwraps .data property when response is object shape", () => {
    const {api} = buildApi({data: {data: [{id: "2"} as any]}});
    const {result} = renderHook(() => useConsentForms(api as any, "/api"));
    expect(Array.isArray(result.current.forms)).toBe(true);
  });

  it("returns empty array when no data is present", () => {
    const {api} = buildApi({data: undefined, isLoading: true});
    const {result} = renderHook(() => useConsentForms(api as any));
    expect(result.current.forms).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("calls onQueryStarted with failing query", () => {
    const refetch = mock(() => {});
    const api = {
      enhanceEndpoints: mock(() => ({
        injectEndpoints: mock((opts: any) => {
          const build = {
            query: mock((def: any) => {
              if (def.onQueryStarted) {
                void def.onQueryStarted(undefined, {
                  queryFulfilled: Promise.reject(new Error("failed")),
                });
              }
              return "q";
            }),
          };
          opts.endpoints(build);
          return {
            useGetPendingConsentsQuery: () => ({
              data: undefined,
              error: "error",
              isLoading: false,
              refetch,
            }),
          };
        }),
      })),
    };
    const {result} = renderHook(() => useConsentForms(api as any));
    expect(result.current.error).toBe("error");
  });
});
