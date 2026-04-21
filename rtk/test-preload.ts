import {mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "web"},
  StyleSheet: {create: (s: unknown) => s},
}));

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async () => {},
  getItemAsync: async () => null,
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
  getNetworkStateAsync: async () => ({isConnected: true}),
}));
