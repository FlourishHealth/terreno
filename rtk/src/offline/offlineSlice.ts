import {createSelector, createSlice, type PayloadAction} from "@reduxjs/toolkit";
import {DateTime} from "luxon";
import {REHYDRATE} from "redux-persist";
import {IsWeb} from "../platform";
import type {
  ConflictRecord,
  ConflictResolution,
  ConnectionQuality,
  HealthCheckSnapshot,
  OfflineOperation,
  QueuedMutation,
  QueuedMutationStatus,
} from "./offlineTypes";

export const OFFLINE_QUEUE_VERSION = 2;

const getInitialConnectionQuality = (): ConnectionQuality => {
  if (IsWeb && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine ? "online" : "offline";
  }
  return "online";
};

export interface OfflineState {
  connectionQuality: ConnectionQuality;
  /** @deprecated Derived from connectionQuality !== 'offline' */
  isOnline: boolean;
  queue: QueuedMutation[];
  conflicts: ConflictRecord[];
  isSyncing: boolean;
  isReplayPausedForAuth: boolean;
  lastHealthCheck?: HealthCheckSnapshot;
  queueVersion: number;
}

const initialState: OfflineState = {
  conflicts: [],
  connectionQuality: getInitialConnectionQuality(),
  isOnline: getInitialConnectionQuality() !== "offline",
  isReplayPausedForAuth: false,
  isSyncing: false,
  queue: [],
  queueVersion: OFFLINE_QUEUE_VERSION,
};

const normalizeQueuedMutation = (mutation: QueuedMutation): QueuedMutation => {
  const operation = mutation.operation ?? mutation.type ?? "update";
  const createdAt = mutation.createdAt ?? mutation.timestamp ?? DateTime.now().toISO();

  return {
    ...mutation,
    attemptCount: mutation.attemptCount ?? 0,
    createdAt,
    idempotencyKey: mutation.idempotencyKey ?? mutation.id,
    modelName: mutation.modelName ?? "Unknown",
    operation,
    status: mutation.status ?? "queued",
    timestamp: createdAt,
    type: operation,
  };
};

const normalizeConflictRecord = (conflict: ConflictRecord): ConflictRecord => {
  const createdAt = conflict.createdAt ?? conflict.timestamp ?? DateTime.now().toISO();
  const serverValue = conflict.serverValue ?? conflict.serverDocument;
  const localArgs = conflict.localArgs ?? conflict.args;

  return {
    ...conflict,
    args: localArgs,
    createdAt,
    localArgs,
    queueId: conflict.queueId ?? conflict.id,
    serverDocument: serverValue,
    serverValue,
    timestamp: createdAt,
  };
};

const syncOnlineFromConnectionQuality = (state: OfflineState): void => {
  state.isOnline = state.connectionQuality !== "offline";
};

export const offlineSlice = createSlice({
  extraReducers: (builder) => {
    builder.addCase(REHYDRATE, (state, action) => {
      state.isSyncing = false;
      state.isReplayPausedForAuth = false;

      const payload = (action as {payload?: {offline?: OfflineState}}).payload;
      const persistedQueue = payload?.offline?.queue;
      if (persistedQueue) {
        state.queue = persistedQueue.map(normalizeQueuedMutation);
      }

      if (state.queueVersion < OFFLINE_QUEUE_VERSION) {
        state.queue = state.queue.filter((mutation) => mutation.status !== "failed");
        state.queueVersion = OFFLINE_QUEUE_VERSION;
      }
    });
  },
  initialState,
  name: "offline",
  reducers: {
    addConflict(state, action: PayloadAction<ConflictRecord>) {
      const normalized = normalizeConflictRecord(action.payload);
      const existingIndex = state.conflicts.findIndex(
        (c) => c.queueId === normalized.queueId && !c.dismissed
      );
      if (existingIndex >= 0) {
        state.conflicts[existingIndex] = normalized;
        return;
      }
      state.conflicts.push(normalized);
    },
    clearConflicts(state) {
      state.conflicts = [];
    },
    clearQueue(state) {
      state.queue = [];
    },
    dequeue(state, action: PayloadAction<string>) {
      state.queue = state.queue.filter((m) => m.id !== action.payload);
    },
    dismissConflict(state, action: PayloadAction<string>) {
      const conflict = state.conflicts.find((c) => c.id === action.payload);
      if (conflict) {
        conflict.dismissed = true;
      }
    },
    enqueue(state, action: PayloadAction<QueuedMutation>) {
      state.queue.push(normalizeQueuedMutation(action.payload));
    },
    markMutationAuthBlocked(state) {
      for (const mutation of state.queue) {
        if (mutation.status === "queued" || mutation.status === "replaying") {
          mutation.status = "authBlocked";
        }
      }
      state.isReplayPausedForAuth = true;
      state.isSyncing = false;
    },
    markMutationStatus(
      state,
      action: PayloadAction<{id: string; status: QueuedMutationStatus; error?: string}>
    ) {
      const mutation = state.queue.find((m) => m.id === action.payload.id);
      if (!mutation) {
        return;
      }
      mutation.status = action.payload.status;
      mutation.error = action.payload.error;
      mutation.lastAttemptAt = DateTime.now().toISO();
      mutation.attemptCount += 1;
    },
    resolveConflictKeepMine(
      state,
      action: PayloadAction<{conflictId: string; serverUpdatedAt?: string}>
    ) {
      const conflict = state.conflicts.find((c) => c.id === action.payload.conflictId);
      if (!conflict) {
        return;
      }

      const mutation = state.queue.find((m) => m.id === conflict.queueId);
      if (mutation) {
        mutation.baseUpdatedAt = action.payload.serverUpdatedAt ?? conflict.serverUpdatedAt;
        mutation.status = "queued";
      }

      conflict.dismissed = true;
    },
    resolveConflictUseServer(state, action: PayloadAction<string>) {
      const conflict = state.conflicts.find((c) => c.id === action.payload);
      if (!conflict) {
        return;
      }
      state.queue = state.queue.filter((m) => m.id !== conflict.queueId);
      conflict.dismissed = true;
    },
    resumeReplayAfterAuth(state) {
      state.isReplayPausedForAuth = false;
      for (const mutation of state.queue) {
        if (mutation.status === "authBlocked") {
          mutation.status = "queued";
        }
      }
    },
    setConnectionQuality(state, action: PayloadAction<ConnectionQuality>) {
      state.connectionQuality = action.payload;
      syncOnlineFromConnectionQuality(state);
    },
    setHealthCheckSnapshot(state, action: PayloadAction<HealthCheckSnapshot>) {
      state.lastHealthCheck = action.payload;
    },
    setOnlineStatus(state, action: PayloadAction<boolean>) {
      state.connectionQuality = action.payload ? "online" : "offline";
      syncOnlineFromConnectionQuality(state);
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    updateQueuedMutation(
      state,
      action: PayloadAction<{id: string; patch: Partial<QueuedMutation>}>
    ) {
      const mutation = state.queue.find((m) => m.id === action.payload.id);
      if (!mutation) {
        return;
      }
      Object.assign(mutation, action.payload.patch);
    },
  },
});

export const {
  setConnectionQuality,
  setOnlineStatus,
  setHealthCheckSnapshot,
  enqueue,
  dequeue,
  clearQueue,
  addConflict,
  dismissConflict,
  clearConflicts,
  setSyncing,
  markMutationAuthBlocked,
  markMutationStatus,
  resumeReplayAfterAuth,
  updateQueuedMutation,
  resolveConflictUseServer,
  resolveConflictKeepMine,
} = offlineSlice.actions;

export const offlineReducer = offlineSlice.reducer;

export type {ConflictRecord, ConflictResolution, OfflineOperation, QueuedMutation};

export const selectConnectionQuality = (state: {offline: OfflineState}): ConnectionQuality =>
  state.offline.connectionQuality;

export const selectIsOnline = (state: {offline: OfflineState}): boolean => state.offline.isOnline;

export const selectIsOnlineSafe = (state: {offline?: OfflineState}): boolean =>
  state.offline?.isOnline ?? true;

export const selectConnectionQualitySafe = (state: {offline?: OfflineState}): ConnectionQuality =>
  state.offline?.connectionQuality ?? "online";

export const selectOfflineQueue = (state: {offline: OfflineState}): QueuedMutation[] =>
  state.offline.queue;

export const selectQueuedMutations = selectOfflineQueue;

export const selectQueueLength = (state: {offline: OfflineState}): number =>
  state.offline.queue.filter((m) => m.status === "queued" || m.status === "authBlocked").length;

export const selectConflicts = (state: {offline: OfflineState}): ConflictRecord[] =>
  state.offline.conflicts;

export const selectUndismissedConflicts = createSelector(
  selectConflicts,
  (conflicts): ConflictRecord[] => conflicts.filter((c) => !c.dismissed)
);

export const selectIsSyncing = (state: {offline: OfflineState}): boolean => state.offline.isSyncing;

export const selectIsReplayPausedForAuth = (state: {offline: OfflineState}): boolean =>
  state.offline.isReplayPausedForAuth;

export const selectLastHealthCheck = (state: {
  offline: OfflineState;
}): HealthCheckSnapshot | undefined => state.offline.lastHealthCheck;

export const selectAuthBlockedQueueLength = (state: {offline: OfflineState}): number =>
  state.offline.queue.filter((m) => m.status === "authBlocked").length;

export const shouldDeferOfflineMutationForQuality = (quality: ConnectionQuality): boolean => {
  return quality === "offline" || quality === "spotty";
};
