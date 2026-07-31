import {mock} from "bun:test";

mock.module("react-native", () => ({
  AppState: {
    addEventListener: () => ({remove: () => {}}),
    currentState: "active",
  },
  Linking: {openURL: async () => true},
  Platform: {OS: "web"},
  StyleSheet: {create: (s: unknown) => s},
}));

// Mirrors the real module surface: expo-secure-store exposes synchronous
// getItem/setItem alongside the *Async variants, and createStorageAdapter's native
// branch depends on the sync pair.
mock.module("expo-secure-store", () => ({
  deleteItemAsync: async () => {},
  getItem: () => null,
  getItemAsync: async () => null,
  setItem: () => {},
  setItemAsync: async () => {},
}));

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => null,
    removeItem: async () => {},
    setItem: async () => {},
  },
}));

mock.module("expo-constants", () => ({
  default: {expoConfig: {extra: {}}},
}));

mock.module("expo-network", () => ({
  addNetworkStateListener: () => ({remove: () => {}}),
  getNetworkStateAsync: async () => ({isConnected: true}),
}));
