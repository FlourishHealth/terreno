import {beforeEach, describe, expect, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {REHYDRATE} from "redux-persist";

import {
  addConflict,
  clearConflicts,
  clearQueue,
  dequeue,
  dismissConflict,
  enqueue,
  markMutationAuthBlocked,
  offlineReducer,
  selectConflicts,
  selectConnectionQuality,
  selectIsOnline,
  selectIsOnlineSafe,
  selectIsReplayPausedForAuth,
  selectIsSyncing,
  selectOfflineQueue,
  selectQueueLength,
  selectUndismissedConflicts,
  setOnlineStatus,
  setSyncing,
} from "./offlineSlice";
import {createTestConflictRecord, createTestQueuedMutation} from "./offlineTestUtils";

const createTestStore = () =>
  configureStore({
    reducer: {offline: offlineReducer},
  });

describe("offlineSlice", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  describe("setOnlineStatus", () => {
    it("sets online status to false", () => {
      store.dispatch(setOnlineStatus(false));
      expect(selectIsOnline(store.getState())).toBe(false);
      expect(selectConnectionQuality(store.getState())).toBe("offline");
    });

    it("sets online status to true", () => {
      store.dispatch(setOnlineStatus(false));
      store.dispatch(setOnlineStatus(true));
      expect(selectIsOnline(store.getState())).toBe(true);
      expect(selectConnectionQuality(store.getState())).toBe("online");
    });

    it("defaults to online", () => {
      expect(selectIsOnline(store.getState())).toBe(true);
    });
  });

  describe("mutation queue", () => {
    const mutation1 = createTestQueuedMutation({
      args: {body: {title: "Updated"}, id: "123"},
      endpointName: "patchTodosById",
      id: "m1",
      operation: "update",
      type: "update",
    });

    const mutation2 = createTestQueuedMutation({
      args: {body: {title: "New Todo"}},
      endpointName: "postTodos",
      id: "m2",
      operation: "create",
      type: "create",
    });

    it("enqueues mutations in FIFO order", () => {
      store.dispatch(enqueue(mutation1));
      store.dispatch(enqueue(mutation2));

      const queue = selectOfflineQueue(store.getState());
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe("m1");
      expect(queue[1].id).toBe("m2");
    });

    it("dequeues by id", () => {
      store.dispatch(enqueue(mutation1));
      store.dispatch(enqueue(mutation2));
      store.dispatch(dequeue("m1"));

      const queue = selectOfflineQueue(store.getState());
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe("m2");
    });

    it("clears entire queue", () => {
      store.dispatch(enqueue(mutation1));
      store.dispatch(enqueue(mutation2));
      store.dispatch(clearQueue());

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("reports queue length", () => {
      expect(selectQueueLength(store.getState())).toBe(0);
      store.dispatch(enqueue(mutation1));
      expect(selectQueueLength(store.getState())).toBe(1);
      store.dispatch(enqueue(mutation2));
      expect(selectQueueLength(store.getState())).toBe(2);
    });

    it("preserves mutation args", () => {
      store.dispatch(enqueue(mutation1));
      const queued = selectOfflineQueue(store.getState())[0];
      expect(queued.args).toEqual({body: {title: "Updated"}, id: "123"});
      expect(queued.endpointName).toBe("patchTodosById");
      expect(queued.type).toBe("update");
    });
  });

  describe("conflicts", () => {
    const conflict1 = createTestConflictRecord({
      args: {body: {title: "Offline"}, id: "123"},
      id: "c1",
      localArgs: {body: {title: "Offline"}, id: "123"},
      serverDocument: {_id: "123", title: "Server Version", updated: "2026-04-15T11:00:00.000Z"},
      serverValue: {_id: "123", title: "Server Version", updated: "2026-04-15T11:00:00.000Z"},
    });

    const conflict2 = createTestConflictRecord({
      args: {body: {completed: true}, id: "456"},
      id: "c2",
      localArgs: {body: {completed: true}, id: "456"},
      serverDocument: {_id: "456", completed: false, title: "Other"},
      serverValue: {_id: "456", completed: false, title: "Other"},
    });

    it("adds conflict records", () => {
      store.dispatch(addConflict(conflict1));
      expect(selectConflicts(store.getState())).toHaveLength(1);
      expect(selectConflicts(store.getState())[0].id).toBe("c1");
    });

    it("dismisses a conflict", () => {
      store.dispatch(addConflict(conflict1));
      store.dispatch(addConflict(conflict2));
      store.dispatch(dismissConflict("c1"));

      const conflicts = selectConflicts(store.getState());
      expect(conflicts[0].dismissed).toBe(true);
      expect(conflicts[1].dismissed).toBe(false);
    });

    it("filters undismissed conflicts", () => {
      store.dispatch(addConflict(conflict1));
      store.dispatch(addConflict(conflict2));
      store.dispatch(dismissConflict("c1"));

      const undismissed = selectUndismissedConflicts(store.getState());
      expect(undismissed).toHaveLength(1);
      expect(undismissed[0].id).toBe("c2");
    });

    it("clears all conflicts", () => {
      store.dispatch(addConflict(conflict1));
      store.dispatch(addConflict(conflict2));
      store.dispatch(clearConflicts());

      expect(selectConflicts(store.getState())).toHaveLength(0);
    });
  });

  describe("selectIsOnlineSafe", () => {
    it("defaults to online when offline reducer is absent", () => {
      expect(selectIsOnlineSafe({})).toBe(true);
    });

    it("reflects offline state when reducer is mounted", () => {
      store.dispatch(setOnlineStatus(false));
      expect(selectIsOnlineSafe(store.getState())).toBe(false);
    });
  });

  describe("auth blocked replay", () => {
    it("marks queued mutations auth blocked", () => {
      store.dispatch(
        enqueue(
          createTestQueuedMutation({
            endpointName: "postTodos",
            id: "auth-1",
          })
        )
      );
      store.dispatch(markMutationAuthBlocked());
      expect(selectIsReplayPausedForAuth(store.getState())).toBe(true);
      expect(selectOfflineQueue(store.getState())[0].status).toBe("authBlocked");
    });
  });

  describe("syncing", () => {
    it("defaults to not syncing", () => {
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("sets syncing state", () => {
      store.dispatch(setSyncing(true));
      expect(selectIsSyncing(store.getState())).toBe(true);
    });

    it("clears syncing state", () => {
      store.dispatch(setSyncing(true));
      store.dispatch(setSyncing(false));
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("resets syncing on redux-persist rehydrate", () => {
      store.dispatch(setSyncing(true));
      store.dispatch({payload: undefined, type: REHYDRATE});
      expect(selectIsSyncing(store.getState())).toBe(false);
    });
  });
});
