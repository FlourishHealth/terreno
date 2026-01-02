import {useEffect} from "react";
import {AppState, type AppStateStatus} from "react-native";

export const useAppLaunchOrForeground = (onAppForeground: () => void): void => {
	// Run on app launch or foreground
	useEffect(() => {
		// This one runs on app launch
		onAppForeground();

		const handleAppStateChange = (nextAppState: AppStateStatus): void => {
			if (nextAppState === "active") {
				// This one runs when the app comes to the foreground
				onAppForeground();
			}
		};

		const subscription = AppState.addEventListener("change", handleAppStateChange);

		return (): void => {
			subscription.remove();
		};
	}, [onAppForeground]);
};
