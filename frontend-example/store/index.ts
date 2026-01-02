import AsyncStorage from "@react-native-async-storage/async-storage";
import {combineReducers, configureStore} from "@reduxjs/toolkit";
import {generateAuthSlice} from "@terreno/rtk";
import {createSentryReduxEnhancer} from "@utils";
import {DateTime} from "luxon";
import {useDispatch} from "react-redux";
import type {Storage} from "redux-persist";
import {persistReducer, persistStore} from "redux-persist";

import appState from "./appState";
import {rtkQueryErrorMiddleware} from "./errors";
import {terrenoApi} from "./sdk";

export * from "./appState";
export {useSentryAndToast} from "./errors";
export * from "./utils";

const authSlice = generateAuthSlice(terrenoApi);

export const {logout} = authSlice;

// Safe storage wrapper that checks for window availability (for SSR compatibility)
const createSafeStorage = (): Storage => {
  return {
    getItem: async (key: string): Promise<string | null> => {
      if (typeof window !== "undefined") {
        return AsyncStorage.getItem(key);
      }
      return null;
    },
    removeItem: async (key: string): Promise<void> => {
      if (typeof window !== "undefined") {
        return AsyncStorage.removeItem(key);
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      if (typeof window !== "undefined") {
        return AsyncStorage.setItem(key, value);
      }
    },
  };
};

const persistConfig = {
  blacklist: ["tracking", "terrenoApi", "profiles", "localFormInstance"],
  key: "root",
  storage: createSafeStorage(),
  timeout: 0, // The code base checks for falsy, so 0 disables
  version: 1,
};

const rootReducer = combineReducers({
  appState,
  auth: authSlice.authReducer,
  terrenoApi: terrenoApi.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const sentryReduxEnhancer = createSentryReduxEnhancer();

const store = configureStore({
  devTools: process.env.NODE_ENV !== "production" && {
    name: `Terreno-${
      typeof window !== "undefined"
        ? // biome-ignore lint/suspicious/noAssignInExpressions: Window name
          window.name || ((window.name = `Window-${DateTime.now().toFormat("HH:mm:ss")}`))
        : "Unknown"
    }`,
  },
  // Redux enhancers: Sentry enhancer is added for error tracking
  // Sentry enhancer type doesn't match exact Redux enhancer signature across different versions
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers({
      autoBatch: {type: "tick"},
      // biome-ignore lint/suspicious/noExplicitAny: Type mismatch between Sentry createReduxEnhancer and configureStore enhancer API
    }).concat(sentryReduxEnhancer as any),
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
      thunk: true,
    }).concat([
      ...authSlice.middleware,
      // RTK Query middleware must be cast as it doesn't match exact Redux middleware type
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query middleware has non-standard typing
      terrenoApi.middleware as any,
      rtkQueryErrorMiddleware,
      // Return value needs casting as concat creates a union type that Redux doesn't accept
      // biome-ignore lint/suspicious/noExplicitAny: Middleware array type inference is complex
    ]) as any;
  },
  reducer: persistedReducer,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch`
export const useAppDispatch: () => AppDispatch = useDispatch;
export {useAppSelector} from "./appState";

export default store;
export * from "./sdk";
