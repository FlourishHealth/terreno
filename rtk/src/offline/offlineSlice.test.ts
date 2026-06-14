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
  markMutationStatus,
  offlineReducer,
  resolveConflictKeepMine,
  resolveConflictUseServer,
  resumeReplayAfterAuth,
  selectConflicts,
  selectConnectionQuality,
  selectIsOnline,
  selectIsOnlineSafe,
  selectIsReplayPausedForAuth,
  selectIsSyncing,
  selectLastHealthCheck,
  selectOfflineQueue,
  selectQueueLength,
  selectUndismissedConflicts,
  setConnectionQuality,
  setHealthCheckSnapshot,
  setOnlineStatus,
  setSyncing,
  updateQueuedMutation,
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

    it("replaces an undismissed conflict that shares the same queue id", () => {
      store.dispatch(addConflict(conflict1));
      store.dispatch(
        addConflict({
          ...conflict1,
          id: "c-replaced",
          serverDocument: {_id: "123", title: "Newer server"},
          serverValue: {_id: "123", title: "Newer server"},
        })
      );

      const conflicts = selectConflicts(store.getState());
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].id).toBe("c-replaced");
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

    it("clears auth pause and restores queued status on resumeReplayAfterAuth", () => {
      store.dispatch(
        enqueue(
          createTestQueuedMutation({
            endpointName: "postTodos",
            id: "auth-2",
          })
        )
      );
      store.dispatch(markMutationAuthBlocked());
      store.dispatch(resumeReplayAfterAuth());

      expect(selectIsReplayPausedForAuth(store.getState())).toBe(false);
      expect(selectOfflineQueue(store.getState())[0].status).toBe("queued");
    });
  });

  describe("mutation status and queue patches", () => {
    const mutation1 = createTestQueuedMutation({
      args: {body: {title: "Updated"}, id: "123"},
      endpointName: "patchTodosById",
      id: "m1",
      operation: "update",
      type: "update",
    });

    it("updates status and increments attempts via markMutationStatus", () => {
      store.dispatch(enqueue(mutation1));
      store.dispatch(markMutationStatus({id: "m1", status: "replaying"}));

      const queued = selectOfflineQueue(store.getState())[0];
      expect(queued.status).toBe("replaying");
      expect(queued.attemptCount).toBe(1);
    });

    it("merges fields via updateQueuedMutation", () => {
      store.dispatch(enqueue(mutation1));
      store.dispatch(updateQueuedMutation({id: "m1", patch: {modelName: "CustomModel"}}));

      expect(selectOfflineQueue(store.getState())[0].modelName).toBe("CustomModel");
    });
  });

  describe("conflict resolution reducers", () => {
    it("marks conflict dismissed and re-queues mutation on resolveConflictKeepMine", () => {
      const queued = createTestQueuedMutation({
        args: {body: {title: "Local"}, id: "99"},
        endpointName: "patchTodosById",
        id: "q-99",
        operation: "update",
        type: "update",
      });
      store.dispatch(enqueue(queued));
      store.dispatch(
        addConflict(
          createTestConflictRecord({
            id: "conf-99",
            localArgs: queued.args,
            queueId: "q-99",
            serverDocument: {_id: "99", title: "Server"},
            serverValue: {_id: "99", title: "Server"},
          })
        )
      );

      store.dispatch(
        resolveConflictKeepMine({
          conflictId: "conf-99",
          serverUpdatedAt: "2026-05-20T10:00:00.000Z",
        })
      );

      expect(selectConflicts(store.getState())[0].dismissed).toBe(true);
      const after = selectOfflineQueue(store.getState())[0];
      expect(after.status).toBe("queued");
      expect(after.baseUpdatedAt).toBe("2026-05-20T10:00:00.000Z");
    });

    it("removes queued mutation on resolveConflictUseServer", () => {
      const queued = createTestQueuedMutation({
        args: {body: {title: "Local"}, id: "88"},
        endpointName: "patchTodosById",
        id: "q-88",
        operation: "update",
        type: "update",
      });
      store.dispatch(enqueue(queued));
      store.dispatch(
        addConflict(
          createTestConflictRecord({
            id: "conf-88",
            localArgs: queued.args,
            queueId: "q-88",
            serverDocument: {_id: "88", title: "Server wins"},
            serverValue: {_id: "88", title: "Server wins"},
          })
        )
      );

      store.dispatch(resolveConflictUseServer("conf-88"));

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
      expect(selectConflicts(store.getState())[0].dismissed).toBe(true);
    });
  });

  describe("connection and health snapshot", () => {
    it("sets arbitrary connection quality including spotty", () => {
      store.dispatch(setConnectionQuality("spotty"));
      expect(selectConnectionQuality(store.getState())).toBe("spotty");
      expect(selectIsOnline(store.getState())).toBe(true);
    });

    it("records the latest health check snapshot", () => {
      store.dispatch(
        setHealthCheckSnapshot({
          checkedAt: "2026-06-01T12:00:00.000Z",
          consecutiveFailures: 2,
          latencyMs: 42,
          recentFailureRate: 0.25,
        })
      );

      expect(selectLastHealthCheck(store.getState())?.latencyMs).toBe(42);
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
