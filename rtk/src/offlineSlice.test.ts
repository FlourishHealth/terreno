import {beforeEach, describe, expect, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";

import {
  addConflict,
  type ConflictRecord,
  clearConflicts,
  clearQueue,
  dequeue,
  dismissConflict,
  enqueue,
  offlineReducer,
  type QueuedMutation,
  selectConflicts,
  selectIsOnline,
  selectIsSyncing,
  selectOfflineQueue,
  selectQueueLength,
  selectUndismissedConflicts,
  setOnlineStatus,
  setSyncing,
} from "./offlineSlice";

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
    });

    it("sets online status to true", () => {
      store.dispatch(setOnlineStatus(false));
      store.dispatch(setOnlineStatus(true));
      expect(selectIsOnline(store.getState())).toBe(true);
    });

    it("defaults to online", () => {
      expect(selectIsOnline(store.getState())).toBe(true);
    });
  });

  describe("mutation queue", () => {
    const mutation1: QueuedMutation = {
      args: {body: {title: "Updated"}, id: "123"},
      endpointName: "patchTodosById",
      id: "m1",
      timestamp: "2026-04-15T10:00:00.000Z",
      type: "update",
    };

    const mutation2: QueuedMutation = {
      args: {body: {title: "New Todo"}},
      endpointName: "postTodos",
      id: "m2",
      timestamp: "2026-04-15T10:01:00.000Z",
      type: "create",
    };

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
    const conflict1: ConflictRecord = {
      args: {body: {title: "Offline"}, id: "123"},
      dismissed: false,
      endpointName: "patchTodosById",
      id: "c1",
      serverDocument: {_id: "123", title: "Server Version", updated: "2026-04-15T11:00:00.000Z"},
      timestamp: "2026-04-15T10:30:00.000Z",
    };

    const conflict2: ConflictRecord = {
      args: {body: {completed: true}, id: "456"},
      dismissed: false,
      endpointName: "patchTodosById",
      id: "c2",
      serverDocument: {_id: "456", completed: false, title: "Other"},
      timestamp: "2026-04-15T10:31:00.000Z",
    };

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
  });
});
