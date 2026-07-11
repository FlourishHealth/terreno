import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook} from "@testing-library/react-native";
import Constants from "expo-constants";
import React from "react";
import {Provider} from "react-redux";

// Capture the AppState "change" handler so tests can simulate foreground transitions.
let appStateChangeHandler: ((state: string) => void) | undefined;
const appStateMock = {
  addEventListener: (_event: string, handler: (state: string) => void) => {
    appStateChangeHandler = handler;
    return {remove: () => {}};
  },
  currentState: "active",
};

// Keep this react-native mock a superset of the preload's mock so other test
// files still resolve AppState / Linking / Platform after this file runs.
mock.module("react-native", () => ({
  AppState: appStateMock,
  Linking: {openURL: async () => true},
  Platform: {OS: "web"},
  StyleSheet: {create: (s: unknown) => s},
}));

// Force IsWeb=true regardless of load order with the native test files.
mock.module("./platform", () => ({IsWeb: true}));

const {emptySplitApi} = await import("./emptyApi");
const {useUpgradeCheck} = await import("./useUpgradeCheck");

interface VersionCheckPayload {
  message?: string;
  pollingIntervalMs?: number;
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

const mockFetchWith = (payload: VersionCheckPayload): ReturnType<typeof mock> => {
  const fetchFn = mock(
    async () =>
      new Response(JSON.stringify(payload), {
        headers: {"content-type": "application/json"},
        status: 200,
      })
  );
  globalThis.fetch = fetchFn as unknown as typeof fetch;
  return fetchFn;
};

const flush = async (ms = 60): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

describe("useUpgradeCheck (web)", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalWindow: unknown;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalWindow = (globalThis as {window?: unknown}).window;
    appStateChangeHandler = undefined;
    appStateMock.currentState = "active";
    constantsWithExtra.expoConfig.extra.buildNumber = 100;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (globalThis as {window?: unknown}).window = originalWindow;
    delete constantsWithExtra.expoConfig.extra.buildNumber;
    emptySplitApi.util.resetApiState();
  });

  it("does not call the backend when the build number is unavailable", async () => {
    delete constantsWithExtra.expoConfig.extra.buildNumber;
    const fetchFn = mockFetchWith({status: "ok"});

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current.isRequired).toBe(false);
    expect(result.current.isWarning).toBe(false);
    unmount();
  });

  it("flags a required upgrade and adopts the server polling interval", async () => {
    const fetchFn = mockFetchWith({
      message: "Please update",
      pollingIntervalMs: 999_999,
      status: "required",
      updateUrl: "https://example.com/update",
    });

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    expect(fetchFn).toHaveBeenCalled();
    expect(result.current.isRequired).toBe(true);
    expect(result.current.requiredMessage).toBe("Please update");
    expect(result.current.isWarning).toBe(false);
    // On web the app can always self-update via reload.
    expect(result.current.canUpdate).toBe(true);
    unmount();
  });

  it("flags a warning upgrade and increments the warning check count", async () => {
    const fetchFn = mockFetchWith({message: "Update soon", status: "warning"});

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    expect(fetchFn).toHaveBeenCalled();
    expect(result.current.isWarning).toBe(true);
    expect(result.current.warningMessage).toBe("Update soon");
    expect(result.current.warningCheckCount).toBe(1);
    expect(result.current.isRequired).toBe(false);
    unmount();
  });

  it("clears upgrade state for an ok status", async () => {
    mockFetchWith({status: "ok"});

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    expect(result.current.isRequired).toBe(false);
    expect(result.current.isWarning).toBe(false);
    unmount();
  });

  it("swallows version-check failures and stays in the default state", async () => {
    const fetchFn = mock(async () => {
      throw new Error("network down");
    });
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    // Wait long enough for RTK Query's retry backoff to exhaust and reject.
    await flush(7000);

    expect(result.current.isRequired).toBe(false);
    expect(result.current.isWarning).toBe(false);
    unmount();
  }, 20_000);

  it("reloads the page on web when onUpdate is invoked", async () => {
    mockFetchWith({status: "required", updateUrl: "https://example.com/update"});
    const reload = mock(() => {});
    (globalThis as {window?: unknown}).window = {location: {reload}};

    const {result, unmount} = renderHook(() => useUpgradeCheck(), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    act(() => {
      result.current.onUpdate();
    });

    expect(reload).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("polls repeatedly using the fallback interval", async () => {
    const fetchFn = mockFetchWith({status: "ok"});

    const {unmount} = renderHook(() => useUpgradeCheck({pollingIntervalMs: 20}), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush(120);

    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
    unmount();
  });

  it("re-checks when the app returns to the foreground", async () => {
    const fetchFn = mockFetchWith({status: "ok"});

    const {unmount} = renderHook(() => useUpgradeCheck({recheckOnForeground: true}), {
      wrapper: createWrapper(createTestStore()),
    });
    await flush();

    const initialCalls = fetchFn.mock.calls.length;
    expect(appStateChangeHandler).toBeDefined();

    await act(async () => {
      appStateChangeHandler?.("background");
      appStateChangeHandler?.("active");
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(fetchFn.mock.calls.length).toBeGreaterThan(initialCalls);
    unmount();
  });
});
