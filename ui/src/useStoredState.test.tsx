import {afterEach, beforeEach, describe, expect, it, mock, spyOn} from "bun:test";
import {act, renderHook} from "@testing-library/react-native";

import {Unifier} from "./Unifier";
import {useStoredState} from "./useStoredState";

// The Unifier module is mocked in bunSetup.ts with complete implementation

describe("useStoredState", () => {
  let getItemMock: ReturnType<typeof mock>;
  let setItemMock: ReturnType<typeof mock>;

  beforeEach(() => {
    // Create fresh mocks for storage operations
    getItemMock = mock(() => Promise.resolve(null));
    setItemMock = mock(() => Promise.resolve());
    Unifier.storage.getItem = getItemMock;
    Unifier.storage.setItem = setItemMock;
  });

  it("should return initialValue and isLoading=true on initial render", async () => {
    getItemMock = mock(() => new Promise((resolve) => setTimeout(() => resolve("stored value"), 100)));
    Unifier.storage.getItem = getItemMock;

    const {result} = renderHook(() => useStoredState("testKey", "initial value"));

    expect(result.current[0]).toBe("initial value");
    expect(result.current[2]).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current[0]).toBe("stored value");
    expect(result.current[2]).toBe(false);
  });

  it("should update state and storage when setter is called", async () => {
    getItemMock = mock(() => Promise.resolve("stored value"));
    setItemMock = mock(() => Promise.resolve(undefined));
    Unifier.storage.getItem = getItemMock;
    Unifier.storage.setItem = setItemMock;

    const {result} = renderHook(() => useStoredState("testKey", "initial value"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current[1]("new value");
    });

    expect(result.current[0]).toBe("new value");

    expect(setItemMock).toHaveBeenCalledWith("testKey", "new value");
  });

  it("should handle errors when reading from storage", async () => {
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    getItemMock = mock(() => Promise.reject(new Error("Storage error")));
    Unifier.storage.getItem = getItemMock;

    const {result} = renderHook(() => useStoredState("testKey", "initial value"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current[0]).toBe("initial value");
    expect(result.current[2]).toBe(false);
    expect(console.error).toHaveBeenCalled();

    console.error = originalConsoleError;
  });

  it("should handle errors when writing to storage", async () => {
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    getItemMock = mock(() => Promise.resolve("stored value"));
    setItemMock = mock(() => Promise.reject(new Error("Storage error")));
    Unifier.storage.getItem = getItemMock;
    Unifier.storage.setItem = setItemMock;

    const {result} = renderHook(() => useStoredState("testKey", "initial value"));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await act(async () => {
      await result.current[1]("new value");
    });

    expect(result.current[0]).toBe("stored value");
    expect(console.error).toHaveBeenCalled();

    console.error = originalConsoleError;
  });

  it("should handle undefined initialValue", async () => {
    getItemMock = mock(() => Promise.resolve(null));
    Unifier.storage.getItem = getItemMock;

    const {result} = renderHook(() => useStoredState("testKey"));

    expect(result.current[0]).toBeUndefined();
    expect(result.current[2]).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(result.current[0]).toBeNull();
    expect(result.current[2]).toBe(false);
  });

  it("should not update state if component unmounts before storage resolves", async () => {
    getItemMock = mock(() => new Promise((resolve) => setTimeout(() => resolve("stored value"), 100)));
    Unifier.storage.getItem = getItemMock;

    const {result, unmount} = renderHook(() => useStoredState("testKey", "initial value"));

    expect(result.current[0]).toBe("initial value");
    expect(result.current[2]).toBe(true);

    unmount();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(result.current[0]).toBe("initial value");
    expect(result.current[2]).toBe(true);
  });
});
