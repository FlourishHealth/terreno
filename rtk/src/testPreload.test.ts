import {describe, expect, it} from "bun:test";

// Invoke the mocked module factories registered in test-preload.ts so
// their bodies (and returned functions) are recognised as covered.
describe("test-preload default mocks", () => {
  it("expo-secure-store mock returns a no-op store", async () => {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync("k", "v");
    await SecureStore.deleteItemAsync("k");
    expect(await SecureStore.getItemAsync("k")).toBeNull();
  });

  it("AsyncStorage mock returns a no-op store", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem("k", "v");
    await AsyncStorage.removeItem("k");
    expect(await AsyncStorage.getItem("k")).toBeNull();
  });

  it("expo-network mock reports a connected network", async () => {
    const network = await import("expo-network");
    const state = await network.getNetworkStateAsync();
    expect(state.isConnected).toBe(true);
  });

  it("expo-constants mock exposes an empty config", async () => {
    const Constants = (await import("expo-constants")).default;
    expect(Constants.expoConfig?.extra).toBeDefined();
  });
});
