import AsyncStorage from "@react-native-async-storage/async-storage";
import {combineReducers, configureStore} from "@reduxjs/toolkit";
import {
  createOfflineMiddleware,
  generateAuthSlice,
  type OfflineState,
  type QueuedMutation,
} from "@terreno/rtk";
import {createSentryReduxEnhancer} from "@utils";
import {DateTime} from "luxon";
import {useDispatch} from "react-redux";
import type {Storage as PersistStorage} from "redux-persist";
import {createTransform, persistReducer, persistStore} from "redux-persist";

import appState from "./appState";
import {rtkQueryErrorMiddleware} from "./errors";
import {terrenoApi} from "./sdk";

export * from "./appState";
export {useSentryAndToast} from "./errors";
export * from "./utils";

const authSlice = generateAuthSlice(terrenoApi);

const offlineConfig = createOfflineMiddleware({
  api: terrenoApi,
  offline: {
    enabled: true,
    models: [
      {
        modelName: "Todo",
        tagType: "todos",
        endpoints: {
          create: {endpointName: "postTodos"},
          delete: {endpointName: "deleteTodosById"},
          update: {endpointName: "patchTodosById"},
        },
      },
    ],
  },
});

export const {logout} = authSlice;

// Safe storage wrapper that checks for window availability (for SSR compatibility)
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

const OFFLINE_PAYLOAD_STORAGE_PREFIX = "terreno:offlinePayload:";

const getOfflinePayloadStorage = (): Storage | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.sessionStorage;
};

const getOfflinePayloadStorageKey = (id: string): string => {
  return `${OFFLINE_PAYLOAD_STORAGE_PREFIX}${id}`;
};

const storeOfflinePayload = (id: string, args: unknown): void => {
  const storage = getOfflinePayloadStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(getOfflinePayloadStorageKey(id), JSON.stringify(args));
  } catch {
    storage.removeItem(getOfflinePayloadStorageKey(id));
  }
};

const readOfflinePayload = (id: string): unknown => {
  const storage = getOfflinePayloadStorage();
  if (!storage) {
    return undefined;
  }

  const rawPayload = storage.getItem(getOfflinePayloadStorageKey(id));
  if (!rawPayload) {
    return undefined;
  }

  try {
    return JSON.parse(rawPayload);
  } catch {
    storage.removeItem(getOfflinePayloadStorageKey(id));
    return undefined;
  }
};

const removeStaleOfflinePayloads = (activeIds: Set<string>): void => {
  const storage = getOfflinePayloadStorage();
  if (!storage) {
    return;
  }

  const staleKeys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key?.startsWith(OFFLINE_PAYLOAD_STORAGE_PREFIX)) {
      continue;
    }

    const id = key.slice(OFFLINE_PAYLOAD_STORAGE_PREFIX.length);
    if (!activeIds.has(id)) {
      staleKeys.push(key);
    }
  }

  for (const key of staleKeys) {
    storage.removeItem(key);
  }
};

const sanitizeOfflineStateForPersist = (state: OfflineState): OfflineState => {
  const activeIds = new Set<string>();
  const queue = state.queue.map((mutation): QueuedMutation => {
    activeIds.add(mutation.id);
    storeOfflinePayload(mutation.id, mutation.args);

    return {
      ...mutation,
      args: undefined,
    };
  });

  removeStaleOfflinePayloads(activeIds);

  return {
    ...state,
    conflicts: [],
    isSyncing: false,
    queue,
  };
};

const hydrateOfflineStateFromPersist = (state: OfflineState): OfflineState => {
  return {
    ...state,
    conflicts: [],
    isSyncing: false,
    queue: state.queue.map((mutation): QueuedMutation => {
      const args = readOfflinePayload(mutation.id);
      return {
        ...mutation,
        args: args ?? mutation.args,
      };
    }),
  };
};

const offlinePersistTransform = createTransform(
  sanitizeOfflineStateForPersist,
  hydrateOfflineStateFromPersist,
  {whitelist: ["offline"]}
);

const persistConfig = {
  blacklist: ["tracking", "terreno-rtk", "profiles"],
  key: "root",
  storage: createSafeStorage(),
  timeout: 0, // The code base checks for falsy, so 0 disables
  transforms: [offlinePersistTransform],
  version: 1,
};

const rootReducer = combineReducers({
  appState,
  auth: authSlice.authReducer,
  offline: offlineConfig.offlineReducer,
  // Must match the reducerPath in @terreno/rtk's emptySplitApi ("terreno-rtk")
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
      offlineConfig.middleware,
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
