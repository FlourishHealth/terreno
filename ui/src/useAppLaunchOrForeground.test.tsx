import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import {AppState, type AppStateStatus} from "react-native";

import {useAppLaunchOrForeground} from "./useAppLaunchOrForeground";

describe("useAppLaunchOrForeground", () => {
  let changeListener: ((state: AppStateStatus) => void) | undefined;
  let removeMock: ReturnType<typeof mock>;

  beforeEach(() => {
    changeListener = undefined;
    removeMock = mock(() => {});
    // Capture the registered listener so we can simulate foreground transitions.
    AppState.addEventListener = mock(
      (_event: string, listener: (state: AppStateStatus) => void) => {
        changeListener = listener;
        return {remove: removeMock} as unknown as ReturnType<typeof AppState.addEventListener>;
      }
    ) as unknown as typeof AppState.addEventListener;
  });

  it("invokes the callback once on mount (app launch)", () => {
    const onForeground = mock(() => {});
    renderHook(() => useAppLaunchOrForeground(onForeground));

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it("invokes the callback again when the app returns to the foreground", () => {
    const onForeground = mock(() => {});
    renderHook(() => useAppLaunchOrForeground(onForeground));

    changeListener?.("active");
    expect(onForeground).toHaveBeenCalledTimes(2);
  });

  it("does not invoke the callback for non-active state changes", () => {
    const onForeground = mock(() => {});
    renderHook(() => useAppLaunchOrForeground(onForeground));

    changeListener?.("background");
    changeListener?.("inactive");
    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  it("removes the AppState subscription on unmount", () => {
    const onForeground = mock(() => {});
    const {unmount} = renderHook(() => useAppLaunchOrForeground(onForeground));

    unmount();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
