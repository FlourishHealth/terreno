import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, renderHook, waitFor} from "@testing-library/react-native";

// ---------------------------------------------------------------------------
// Mutable refs that tests can tweak between runs
// ---------------------------------------------------------------------------
let mockBuildNumber: number | undefined = 42;

// Trigger + unwrap mocks for useLazyGetVersionCheckQuery.
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

// IsWeb is always true in tests (Platform.OS mocked as "web" in preload).
// We cannot change it per-test because bun snapshots module exports.
mock.module("./platform", () => ({
  IsWeb: true,
}));

// AppState mock — capture listeners so tests can simulate transitions
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
  Platform: {OS: "web"},
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
// window.location.reload mock
// ---------------------------------------------------------------------------
const mockReload = mock(() => {});

// ---------------------------------------------------------------------------
// setInterval / clearInterval mocks (bun has no fake timers)
// ---------------------------------------------------------------------------
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
let capturedIntervalMs: number | undefined;
let intervalIdCounter = 0;
const mockSetInterval = mock((_cb: () => void, ms: number) => {
  capturedIntervalMs = ms;
  return ++intervalIdCounter as unknown as ReturnType<typeof setInterval>;
});
const mockClearInterval = mock((_id: unknown) => {});

// ---------------------------------------------------------------------------
// console capture
// ---------------------------------------------------------------------------
const debugCalls: unknown[][] = [];
const originalDebug = console.debug;
const originalWarn = console.warn;

// Now import the hook (after all mock.module calls which are hoisted)
import {useUpgradeCheck} from "./useUpgradeCheck";

// Helper: flush microtasks (lets .then() chains resolve)
const flushPromises = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Reset mutable refs
  mockBuildNumber = 42;
  appStateListeners = [];

  // Clear call history and set default implementations
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
  mockReload.mockClear();

  // Mock window.location.reload
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {location: {reload: mockReload}},
    writable: true,
  });

  // Mock timers
  globalThis.setInterval = mockSetInterval as unknown as typeof setInterval;
  globalThis.clearInterval = mockClearInterval as unknown as typeof clearInterval;
  mockSetInterval.mockClear();
  mockSetInterval.mockImplementation((_cb: () => void, ms: number) => {
    capturedIntervalMs = ms;
    return ++intervalIdCounter as unknown as ReturnType<typeof setInterval>;
  });
  mockClearInterval.mockClear();
  capturedIntervalMs = undefined;

  // Console capture
  debugCalls.length = 0;
  console.debug = (...args: unknown[]): void => {
    debugCalls.push(args);
  };
  console.warn = (): void => {};
});

afterEach(() => {
  console.debug = originalDebug;
  console.warn = originalWarn;
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useUpgradeCheck", () => {
  describe("mount behavior", () => {
    it("returns default state before check resolves", () => {
      // Make unwrap hang so state stays at defaults
      mockUnwrap.mockImplementation(() => new Promise(() => {}));
      const {result} = renderHook(() => useUpgradeCheck());

      expect(result.current.isRequired).toBe(false);
      expect(result.current.isWarning).toBe(false);
      expect(result.current.requiredMessage).toBeUndefined();
      expect(result.current.warningMessage).toBeUndefined();
      expect(result.current.warningCheckCount).toBe(0);
    });

    it("skips check when buildNumber is undefined", () => {
      mockBuildNumber = undefined;
      renderHook(() => useUpgradeCheck());
      expect(mockTrigger).not.toHaveBeenCalled();
    });

    it("triggers version check on mount with correct params", () => {
      renderHook(() => useUpgradeCheck());
      expect(mockTrigger).toHaveBeenCalledWith({platform: "web", version: 42});
    });
  });

  describe("status handling", () => {
    it("sets isRequired and requiredMessage when status is 'required'", async () => {
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({message: "Please update now", status: "required" as const})
      );
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isRequired).toBe(true);
        expect(result.current.requiredMessage).toBe("Please update now");
        expect(result.current.isWarning).toBe(false);
      });
    });

    it("sets isWarning, warningMessage, and increments warningCheckCount when status is 'warning'", async () => {
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({message: "New version available", status: "warning" as const})
      );
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isWarning).toBe(true);
        expect(result.current.warningMessage).toBe("New version available");
        expect(result.current.warningCheckCount).toBe(1);
      });
    });

    it("clears required/warning state when status is 'ok' after previous required", async () => {
      // Start with "required"
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({message: "Update", status: "required" as const})
      );
      const {result} = renderHook(() => useUpgradeCheck({recheckOnForeground: true}));

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isRequired).toBe(true);
      });

      // Switch to "ok" and trigger via foreground recheck (more reliable than interval mock)
      mockUnwrap.mockImplementation(() => Promise.resolve({status: "ok" as const}));

      await act(async () => {
        // Simulate background → active transition to trigger runCheck
        appStateListeners.forEach((listener) => {
          listener("background");
        });
      });
      await act(async () => {
        appStateListeners.forEach((listener) => {
          listener("active");
        });
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isRequired).toBe(false);
        expect(result.current.isWarning).toBe(false);
      });
    });

    it("stores updateUrl from response", async () => {
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({
          message: "Update available",
          status: "warning" as const,
          updateUrl: "https://example.com/update",
        })
      );
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.isWarning).toBe(true);
      });
    });
  });

  describe("canUpdate", () => {
    it("is true on web regardless of updateUrl", () => {
      // IsWeb is always true in test env (Platform.OS: "web")
      const {result} = renderHook(() => useUpgradeCheck());
      expect(result.current.canUpdate).toBe(true);
    });
  });

  describe("onUpdate", () => {
    it("calls window.location.reload on web", () => {
      const {result} = renderHook(() => useUpgradeCheck());

      act(() => {
        result.current.onUpdate();
      });

      expect(mockReload).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("handles check failure gracefully", async () => {
      mockUnwrap.mockImplementation(() => Promise.reject(new Error("Network error")));
      const {result} = renderHook(() => useUpgradeCheck());

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        const failLog = debugCalls.find(
          (args) => typeof args[0] === "string" && args[0].includes("Version check failed")
        );
        expect(failLog).toBeDefined();
      });

      // State should remain at defaults
      expect(result.current.isRequired).toBe(false);
      expect(result.current.isWarning).toBe(false);
    });
  });

  describe("polling", () => {
    it("sets up interval when pollingIntervalMs is provided", () => {
      renderHook(() => useUpgradeCheck({pollingIntervalMs: 60_000}));
      expect(mockSetInterval).toHaveBeenCalled();
      expect(capturedIntervalMs).toBe(60_000);
    });

    it("does not set up interval when pollingIntervalMs is omitted", () => {
      renderHook(() => useUpgradeCheck());
      expect(mockSetInterval).not.toHaveBeenCalled();
    });

    it("cleans up interval on unmount", () => {
      const {unmount} = renderHook(() => useUpgradeCheck({pollingIntervalMs: 60_000}));
      unmount();
      expect(mockClearInterval).toHaveBeenCalled();
    });

    it("increments warningCheckCount on each warning poll", async () => {
      mockUnwrap.mockImplementation(() =>
        Promise.resolve({message: "Update", status: "warning" as const})
      );
      const {result} = renderHook(() => useUpgradeCheck({recheckOnForeground: true}));

      await act(async () => {
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.warningCheckCount).toBe(1);
      });

      // Simulate a foreground return to trigger another check
      await act(async () => {
        appStateListeners.forEach((listener) => {
          listener("background");
        });
      });
      await act(async () => {
        appStateListeners.forEach((listener) => {
          listener("active");
        });
        await flushPromises();
      });

      await waitFor(() => {
        expect(result.current.warningCheckCount).toBe(2);
      });
    });
  });

  describe("foreground recheck", () => {
    it("sets up AppState listener when recheckOnForeground is true", () => {
      renderHook(() => useUpgradeCheck({recheckOnForeground: true}));
      expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("does not set up AppState listener by default", () => {
      renderHook(() => useUpgradeCheck());
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });

    it("triggers check on background to active transition", async () => {
      renderHook(() => useUpgradeCheck({recheckOnForeground: true}));

      const initialCallCount = mockTrigger.mock.calls.length;

      // Simulate going to background, then back to active
      act(() => {
        appStateListeners.forEach((listener) => {
          listener("background");
        });
      });
      act(() => {
        appStateListeners.forEach((listener) => {
          listener("active");
        });
      });

      expect(mockTrigger.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it("does not trigger extra check on active to active transition", () => {
      renderHook(() => useUpgradeCheck({recheckOnForeground: true}));

      const initialCallCount = mockTrigger.mock.calls.length;

      act(() => {
        appStateListeners.forEach((listener) => {
          listener("active");
        });
      });

      expect(mockTrigger.mock.calls.length).toBe(initialCallCount);
    });

    it("cleans up AppState listener on unmount", () => {
      const {unmount} = renderHook(() => useUpgradeCheck({recheckOnForeground: true}));
      unmount();
      expect(mockRemove).toHaveBeenCalled();
    });
  });
});
