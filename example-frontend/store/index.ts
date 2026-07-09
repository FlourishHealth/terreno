import AsyncStorage from "@react-native-async-storage/async-storage";
import {combineReducers, configureStore} from "@reduxjs/toolkit";
import {generateBetterAuthSlice, registerTerrenoDevStore} from "@terreno/rtk";
import {createSentryReduxEnhancer} from "@utils";
import {DateTime} from "luxon";
import {useDispatch} from "react-redux";
import type {Storage as PersistStorage} from "redux-persist";
import {persistReducer, persistStore} from "redux-persist";

import {betterAuthClient} from "@/lib/betterAuth";
import appState from "./appState";
import {rtkQueryErrorMiddleware} from "./errors";
import {terrenoApi} from "./sdk";

export * from "./appState";
export {useSentryAndToast} from "./errors";
export * from "./utils";

const betterAuth = generateBetterAuthSlice({authClient: betterAuthClient});

export const logout = betterAuth.actions.logout;
export const syncBetterAuthSession = betterAuth.syncSession;

const createSafeStorage = (): PersistStorage => {
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
  blacklist: ["tracking", "terreno-rtk", "profiles", "betterAuth"],
  key: "root",
  storage: createSafeStorage(),
  timeout: 0,
  version: 1,
};

const rootReducer = combineReducers({
  appState,
  betterAuth: betterAuth.reducer,
  "terreno-rtk": terrenoApi.reducer,
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
  enhancers: (getDefaultEnhancers) =>
    getDefaultEnhancers({
      autoBatch: {type: "tick"},
      // biome-ignore lint/suspicious/noExplicitAny: Sentry enhancer typing mismatch
    }).concat(sentryReduxEnhancer as any),
  middleware: (getDefaultMiddleware) => {
    return getDefaultMiddleware({
      immutableCheck: false,
      serializableCheck: false,
      thunk: true,
    }).concat([
      ...betterAuth.middleware,
      // biome-ignore lint/suspicious/noExplicitAny: RTK Query middleware typing
      terrenoApi.middleware as any,
      rtkQueryErrorMiddleware,
      // biome-ignore lint/suspicious/noExplicitAny: Middleware array inference
    ]) as any;
  },
  reducer: persistedReducer,
});

registerTerrenoDevStore(store);

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export {useAppSelector} from "./appState";

export default store;
export * from "./sdk";
