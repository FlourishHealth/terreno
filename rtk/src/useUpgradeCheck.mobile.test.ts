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
const mockUnwrap = mock((): Promise<MockVersionCheckResponse> => Promise.resolve({status: "ok"}));
const mockTrigger = mock((..._args: unknown[]) => ({unwrap: mockUnwrap}));

mock.module("./emptyApi", () => ({
  useLazyGetVersionCheckQuery: () => [mockTrigger],
}));

// IsWeb is false to exercise native code paths
mock.module("./platform", () => ({
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

// ---------------------------------------------------------------------------
// Timer mocks
// ---------------------------------------------------------------------------
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
let intervalIdCounter = 0;
const mockSetInterval = mock((_cb: () => void, _ms: number) => {
  return ++intervalIdCounter as unknown as ReturnType<typeof setInterval>;
});
const mockClearInterval = mock((_id: unknown) => {});

// ---------------------------------------------------------------------------
// Console capture
// ---------------------------------------------------------------------------
const warnCalls: unknown[][] = [];
const originalDebug = console.debug;
const originalWarn = console.warn;

import {useUpgradeCheck} from "./useUpgradeCheck";

const flushPromises = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  mockBuildNumber = 42;
  appStateListeners = [];

  mockUnwrap.mockClear();
  mockUnwrap.mockImplementation(() => Promise.resolve({status: "ok" as const}));
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

  globalThis.setInterval = mockSetInterval as unknown as typeof setInterval;
  globalThis.clearInterval = mockClearInterval as unknown as typeof clearInterval;
  mockSetInterval.mockClear();
  mockClearInterval.mockClear();

  warnCalls.length = 0;
  console.debug = () => {};
  console.warn = (...args: unknown[]): void => {
    warnCalls.push(args);
  };
});

afterEach(() => {
  console.debug = originalDebug;
  console.warn = originalWarn;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

describe("useUpgradeCheck (mobile)", () => {
  describe("onUpdate", () => {
    it("calls Linking.openURL when updateUrl is available", async () => {
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({
          status: "warning" as const,
          updateUrl: "https://apps.apple.com/app/123",
        })
      );
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isWarning).toBe(true);
      });

      act(() => {
        result.current.onUpdate();
      });

      expect(mockOpenURL).toHaveBeenCalledWith("https://apps.apple.com/app/123");
    });

    it("logs warning when no updateUrl is available on mobile", async () => {
      mockUnwrap.mockImplementation(() => Promise.resolve({status: "warning" as const}));
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isWarning).toBe(true);
      });

      act(() => {
        result.current.onUpdate();
      });

      const noUrlWarn = warnCalls.find(
        (args) => typeof args[0] === "string" && args[0].includes("no update URL")
      );
      expect(noUrlWarn).toBeDefined();
    });

    it("logs warning when Linking.openURL rejects", async () => {
      mockOpenURL.mockImplementation(() => Promise.reject(new Error("Cannot open URL")));
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({
          status: "warning" as const,
          updateUrl: "https://apps.apple.com/app/123",
        })
      );
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isWarning).toBe(true);
      });

      await act(async () => {
        result.current.onUpdate();
        await flushPromises();
      });

      const failWarn = warnCalls.find(
        (args) => typeof args[0] === "string" && args[0].includes("Failed to open update URL")
      );
      expect(failWarn).toBeDefined();
    });
  });

  describe("canUpdate", () => {
    it("is false on mobile when updateUrl is not set", () => {
      const {result} = renderHook(() => useUpgradeCheck());
      expect(result.current.canUpdate).toBe(false);
    });

    it("is true on mobile when updateUrl is set", async () => {
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({
          status: "warning" as const,
          updateUrl: "https://apps.apple.com/app/123",
        })
      );
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.canUpdate).toBe(true);
      });
    });
  });
});
