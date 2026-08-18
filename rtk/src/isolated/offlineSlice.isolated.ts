import {afterAll, describe, it, mock} from "bun:test";
import {assert} from "chai";

// The initial online status is computed once, at module import time, from
// navigator.onLine on web. Stub both before importing offlineSlice so the
// browser branch of getInitialOnlineStatus runs.
mock.module("react-native", () => ({
  Platform: {OS: "web"},
  StyleSheet: {create: (styles: unknown) => styles},
}));
mock.module("../platform", () => ({IsWeb: true}));

const originalNavigator = globalThis.navigator;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {onLine: false},
  writable: true,
});

const {offlineSlice, selectIsOnline} = await import("../offlineSlice");

afterAll(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
    writable: true,
  });
});

// Runs in isolation because the navigator stub must be in place before the
// slice module is evaluated, which would leak into the rest of the suite.
describe("offlineSlice initial online status on web", () => {
  it("starts offline when navigator reports the browser is offline", () => {
    const state = offlineSlice.reducer(undefined, {type: "@@INIT"});

    assert.isFalse(state.isOnline);
    assert.isFalse(selectIsOnline({offline: state}));
  });
});
