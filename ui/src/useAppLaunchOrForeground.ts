import {useEffect} from "react";
import {AppState, type AppStateStatus} from "react-native";

/**
 * Runs `onAppForeground` once on mount (app launch) and again every time the app returns to the
 * foreground (AppState transitions to "active"). Useful for refetching data, revalidating auth, or
 * kicking off a sync when the user comes back to the app.
 *
 * The callback is a dependency of the effect, so wrap it in `useCallback` in the caller to avoid
 * re-subscribing on every render.
 */
export const useAppLaunchOrForeground = (onAppForeground: () => void): void => {
  // Run on app launch or whenever the app returns to the foreground.
  useEffect(() => {
    // Runs on app launch (mount).
    onAppForeground();

    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      if (nextAppState === "active") {
        onAppForeground();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return (): void => {
      subscription.remove();
    };
  }, [onAppForeground]);
};
