/**
 * Isolated tests for useUpgradeCheck mobile-only paths.
 *
 * These run in a separate bun process because they need IsWeb=false,
 * which cannot be changed per-test (bun snapshots module exports).
 */
import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, renderHook, waitFor} from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mutable refs
// ---------------------------------------------------------------------------
let mockBuildNumber: number | undefined = 42;

interface MockVersionCheckResponse {
  message?: string;
  status: "ok" | "warning" | "required";
  updateUrl?: string;
}
const mockUnwrap = mock(
  (): Promise<MockVersionCheckResponse> =>
    Promise.resolve({status: "warning", updateUrl: "https://example.com/update"})
);
const mockTrigger = mock((..._args: unknown[]) => ({unwrap: mockUnwrap}));

mock.module("../emptyApi", () => ({
  useLazyGetVersionCheckQuery: () => [mockTrigger],
}));

// IsWeb = false so we exercise the mobile onUpdate paths
mock.module("../platform", () => ({
  IsWeb: false,
}));

let appStateListeners: Array<(state: string) => void> = [];
const mockRemove = mock(() => {});
const mockAddEventListener = mock((_event: string, handler: (state: string) => void) => {
  appStateListeners.push(handler);
  return {remove: mockRemove};
});
const mockOpenURL = mock(() => Promise.resolve(true));

mock.module("react-native", () => ({
  AppState: {
    addEventListener: mockAddEventListener,
    currentState: "active",
  },
  Linking: {openURL: mockOpenURL},
  Platform: {OS: "ios"},
  StyleSheet: {create: (s: unknown) => s},
}));

mock.module("expo-constants", () => ({
  default: {
    get expoConfig() {
      return {extra: {buildNumber: mockBuildNumber}};
    },
  },
}));

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async () => {},
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    removeItem: async () => {},
    setItem: async () => {},
  },
}));

mock.module("expo-network", () => ({
  getNetworkStateAsync: async () => ({isConnected: true}),
}));

// Import after all mock.module calls
import {useUpgradeCheck} from "../useUpgradeCheck";

const flushPromises = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
const warnCalls: unknown[][] = [];
const originalWarn = console.warn;
const originalDebug = console.debug;

beforeEach(() => {
  mockBuildNumber = 42;
  appStateListeners = [];

  mockUnwrap.mockClear();
  mockUnwrap.mockImplementation(() =>
    Promise.resolve({status: "warning" as const, updateUrl: "https://example.com/update"})
  );
  mockTrigger.mockClear();
  mockTrigger.mockImplementation((..._args: unknown[]) => ({unwrap: mockUnwrap}));
  mockRemove.mockClear();
  mockAddEventListener.mockClear();
  mockAddEventListener.mockImplementation((_event: string, handler: (state: string) => void) => {
    appStateListeners.push(handler);
    return {remove: mockRemove};
  });
  mockOpenURL.mockClear();
  mockOpenURL.mockImplementation(() => Promise.resolve(true));

  warnCalls.length = 0;
  console.warn = (...args: unknown[]): void => {
    warnCalls.push(args);
  };
  console.debug = (): void => {};
});

afterEach(() => {
  console.warn = originalWarn;
  console.debug = originalDebug;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useUpgradeCheck (mobile)", () => {
  it("canUpdate is true when updateUrl is set", async () => {
    const {result} = renderHook(() => useUpgradeCheck());

    await act(async () => {
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.canUpdate).toBe(true);
    });
  });

  it("canUpdate is false when no updateUrl", () => {
    mockUnwrap.mockImplementation(() => new Promise(() => {}));
    const {result} = renderHook(() => useUpgradeCheck());
    expect(result.current.canUpdate).toBe(false);
  });

  it("onUpdate calls Linking.openURL with updateUrl", async () => {
    const {result} = renderHook(() => useUpgradeCheck());

    await act(async () => {
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.canUpdate).toBe(true);
    });

    act(() => {
      result.current.onUpdate();
    });

    expect(mockOpenURL).toHaveBeenCalledWith("https://example.com/update");
  });

  it("onUpdate logs warning when no updateUrl on mobile", () => {
    mockUnwrap.mockImplementation(() => Promise.resolve({status: "ok" as const}));
    const {result} = renderHook(() => useUpgradeCheck());

    act(() => {
      result.current.onUpdate();
    });

    const noUrlWarn = warnCalls.find(
      (args) => typeof args[0] === "string" && args[0].includes("no update URL")
    );
    expect(noUrlWarn).toBeDefined();
  });
});
