import {beforeEach, describe, expect, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";

import {shouldBlockOfflineMutationAuthFailure} from "../emptyApi";
import {configureOfflineMutationEndpoints, shouldDeferOfflineMutation} from "./offlineGate";
import {offlineReducer, setConnectionQuality, setOnlineStatus} from "./offlineSlice";

const createTestStore = () =>
  configureStore({
    reducer: {offline: offlineReducer},
  });

describe("offlineGate", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    configureOfflineMutationEndpoints([]);
  });

  describe("configureOfflineMutationEndpoints", () => {
    it("registers endpoint names", () => {
      configureOfflineMutationEndpoints(["postTodos", "patchTodosById"]);
      store.dispatch(setOnlineStatus(false));
      expect(shouldDeferOfflineMutation("postTodos", store.getState)).toBe(true);
      expect(shouldDeferOfflineMutation("patchTodosById", store.getState)).toBe(true);
    });

    it("replaces previous endpoints on re-configure", () => {
      configureOfflineMutationEndpoints(["postTodos"]);
      configureOfflineMutationEndpoints(["patchTodosById"]);
      store.dispatch(setOnlineStatus(false));
      expect(shouldDeferOfflineMutation("postTodos", store.getState)).toBe(false);
      expect(shouldDeferOfflineMutation("patchTodosById", store.getState)).toBe(true);
    });
  });

  describe("shouldDeferOfflineMutation", () => {
    it("returns false for unregistered endpoints", () => {
      configureOfflineMutationEndpoints(["postTodos"]);
      store.dispatch(setOnlineStatus(false));
      expect(shouldDeferOfflineMutation("postUsers", store.getState)).toBe(false);
    });

    it("returns false when online even for registered endpoints", () => {
      configureOfflineMutationEndpoints(["postTodos"]);
      expect(shouldDeferOfflineMutation("postTodos", store.getState)).toBe(false);
    });

    it("returns true when offline for registered endpoints", () => {
      configureOfflineMutationEndpoints(["postTodos"]);
      store.dispatch(setOnlineStatus(false));
      expect(shouldDeferOfflineMutation("postTodos", store.getState)).toBe(true);
    });

    it("returns true when connection is spotty for registered endpoints", () => {
      configureOfflineMutationEndpoints(["postTodos"]);
      store.dispatch(setConnectionQuality("spotty"));
      expect(shouldDeferOfflineMutation("postTodos", store.getState)).toBe(true);
    });
  });

  describe("shouldBlockOfflineMutationAuthFailure", () => {
    it("returns true for configured offline mutations regardless of connection quality", () => {
      configureOfflineMutationEndpoints(["postTodos"]);

      expect(
        shouldBlockOfflineMutationAuthFailure({
          endpoint: "postTodos",
          type: "mutation",
        } as Parameters<typeof shouldBlockOfflineMutationAuthFailure>[0])
      ).toBe(true);
    });

    it("returns false for queries and unconfigured mutations", () => {
      configureOfflineMutationEndpoints(["postTodos"]);

      expect(
        shouldBlockOfflineMutationAuthFailure({
          endpoint: "postTodos",
          type: "query",
        } as Parameters<typeof shouldBlockOfflineMutationAuthFailure>[0])
      ).toBe(false);
      expect(
        shouldBlockOfflineMutationAuthFailure({
          endpoint: "postUsers",
          type: "mutation",
        } as Parameters<typeof shouldBlockOfflineMutationAuthFailure>[0])
      ).toBe(false);
    });
  });
});
