import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook} from "@testing-library/react-native";
import Constants from "expo-constants";
import React from "react";
import {Provider} from "react-redux";

const openedUrls: string[] = [];

// Keep this react-native mock a superset of the preload's mock so other test
// files still resolve AppState / Linking / Platform after this file runs.
mock.module("react-native", () => ({
  AppState: {
    addEventListener: () => ({remove: () => {}}),
    currentState: "active",
  },
  Linking: {
    openURL: async (url: string) => {
      openedUrls.push(url);
      return true;
    },
  },
  Platform: {OS: "ios"},
  StyleSheet: {create: (s: unknown) => s},
}));

// Force IsWeb=false so the mobile update path is exercised.
mock.module("./platform", () => ({IsWeb: false}));

const {emptySplitApi} = await import("./emptyApi");
const {useUpgradeCheck} = await import("./useUpgradeCheck");

interface VersionCheckPayload {
  message?: string;
  status: "ok" | "warning" | "required";
  updateUrl?: string;
}

const constantsWithExtra = Constants as unknown as {
  expoConfig: {extra: Record<string, unknown>};
};

const createTestStore = () =>
  configureStore({
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(emptySplitApi.middleware),
    reducer: {[emptySplitApi.reducerPath]: emptySplitApi.reducer},
  });

const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return Wrapper;
};

const mockFetchWith = (payload: VersionCheckPayload): void => {
  globalThis.fetch = mock(
    async () =>
      new Response(JSON.stringify(payload), {
        headers: {"content-type": "application/json"},
        status: 200,
      })
  ) as unknown as typeof fetch;
};

const flush = async (ms = 60): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

describe("useUpgradeCheck (native)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    openedUrls.length = 0;
    constantsWithExtra.expoConfig.extra.buildNumber = 100;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete constantsWithExtra.expoConfig.extra.buildNumber;
    emptySplitApi.util.resetApiState();
  });

  it("opens the update URL on native when onUpdate is invoked", async () => {
    mockFetchWith({status: "required", updateUrl: "https://example.com/app-update"});

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    // canUpdate on native depends on having a resolved update URL.
    expect(result.current.canUpdate).toBe(true);

    await act(async () => {
      result.current.onUpdate();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(openedUrls).toEqual(["https://example.com/app-update"]);
    unmount();
  });

  it("does not open a URL on native when no update URL is available", async () => {
    mockFetchWith({status: "required"});

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    expect(result.current.canUpdate).toBe(false);

    await act(async () => {
      result.current.onUpdate();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(openedUrls).toEqual([]);
    unmount();
  });
});
