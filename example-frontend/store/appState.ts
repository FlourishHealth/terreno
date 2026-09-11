import {createSlice, type PayloadAction} from "@reduxjs/toolkit";

type AppState = {
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
const appStateSlice = createSlice({
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

export default appStateSlice.reducer;
