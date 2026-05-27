import {createSlice, type PayloadAction} from "@reduxjs/toolkit";
import {REHYDRATE} from "redux-persist";

import {IsWeb} from "./platform";

const getInitialOnlineStatus = (): boolean => {
  if (IsWeb && typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
};

export interface QueuedMutation {
  /** Unique identifier for this queued mutation */
  id: string;
  /** RTK Query endpoint name, e.g. "patchTodosById" */
  endpointName: string;
  /** Original mutation arguments */
  args: unknown;
  /** ISO timestamp of when the mutation was queued */
  timestamp: string;
  /** Document `_updatedAt` at queue time (used for If-Unmodified-Since on replay) */
  baseUpdatedAt?: string;
  /** The type of CRUD operation */
  type: "create" | "update" | "delete";
  /** Auth user ID when the mutation was queued; replay is skipped if it does not match the current user */
  userId?: string;
}

export interface ConflictRecord {
  /** Unique identifier for this conflict */
  id: string;
  /** RTK Query endpoint name that caused the conflict */
  endpointName: string;
  /** Original mutation arguments that were rejected */
  args: unknown;
  /** The current server version of the document */
  serverDocument: unknown;
  /** ISO timestamp of when the conflict was detected */
  timestamp: string;
  /** Whether the user has dismissed this conflict notification */
  dismissed: boolean;
}

export interface OfflineState {
  isOnline: boolean;
  queue: QueuedMutation[];
  conflicts: ConflictRecord[];
  isSyncing: boolean;
}

const initialState: OfflineState = {
  conflicts: [],
  isOnline: getInitialOnlineStatus(),
  isSyncing: false,
  queue: [],
};

export const offlineSlice = createSlice({
  extraReducers: (builder) => {
    builder.addCase(REHYDRATE, (state) => {
      state.isSyncing = false;
    });
  },
  initialState,
  name: "offline",
  reducers: {
    addConflict(state, action: PayloadAction<ConflictRecord>) {
      state.conflicts.push(action.payload);
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
      state.queue.push(action.payload);
    },
    setOnlineStatus(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
  },
});

export const {
  setOnlineStatus,
  enqueue,
  dequeue,
  clearQueue,
  addConflict,
  dismissConflict,
  clearConflicts,
  setSyncing,
} = offlineSlice.actions;

export const offlineReducer = offlineSlice.reducer;

// Selectors
export const selectIsOnline = (state: {offline: OfflineState}): boolean => state.offline.isOnline;

/** Safe online check when the offline reducer may not be mounted (defaults to online). */
export const selectIsOnlineSafe = (state: {offline?: OfflineState}): boolean =>
  state.offline?.isOnline ?? true;

export const selectOfflineQueue = (state: {offline: OfflineState}): QueuedMutation[] =>
  state.offline.queue;

export const selectQueueLength = (state: {offline: OfflineState}): number =>
  state.offline.queue.length;

export const selectConflicts = (state: {offline: OfflineState}): ConflictRecord[] =>
  state.offline.conflicts;

export const selectUndismissedConflicts = (state: {offline: OfflineState}): ConflictRecord[] =>
  state.offline.conflicts.filter((c) => !c.dismissed);

export const selectIsSyncing = (state: {offline: OfflineState}): boolean => state.offline.isSyncing;
