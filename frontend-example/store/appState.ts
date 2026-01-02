import type {RootState} from "@terreno/rtk";
import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import {type TypedUseSelectorHook, useSelector} from "react-redux";

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export type AppState = {
	darkMode: boolean;
	language: string;
};

const initialState: AppState = {
	darkMode: false,
	language: "en",
};

// State that is local to the app and not associated with a fetched API document.
// In the future we may want to sync this between apps but for now persisting it locally is
// sufficient.
export const appStateSlice = createSlice({
	initialState,
	name: "appState",
	reducers: {
		resetAppState: () => initialState,
		setDarkMode: (state, action: PayloadAction<boolean>) => {
			state.darkMode = action.payload;
		},
		setLanguage: (state, action: PayloadAction<string>) => {
			state.language = action.payload;
		},
	},
});

export const {setDarkMode, setLanguage, resetAppState} = appStateSlice.actions;

export const useSelectDarkMode = (): boolean => {
	return useAppSelector((state: RootState): boolean => {
		return state.appState.darkMode;
	});
};

export const useSelectLanguage = (): string => {
	return useAppSelector((state: RootState): string => {
		return state.appState.language;
	});
};

export default appStateSlice.reducer;
