/**
 * SyncDebugLog — an opt-in, in-memory event recorder for @terreno/syncdb.
 *
 * It captures the semantic sync events the client produces (local mutations,
 * inbound server deltas/patches, outbox send/ack/nack/retry/failure, conflicts,
 * reconcile/replay phases, connectivity) into a fixed-capacity circular buffer.
 * This is the data source behind the "sync debugger" UI (a Redux-DevTools-style
 * live stream) and is deliberately shaped as a plain, JSON-serializable snapshot
 * so the same surface can be exposed over MCP in the future without change:
 *
 *   const snapshot = client.debug?.snapshot(); // -> return straight from an MCP tool
 *
 * Design notes:
 * - Zero overhead when disabled: the client never constructs event objects unless
 *   a log exists (call sites guard with `emit?.(...)`, which short-circuits arg
 *   evaluation).
 * - Circular buffer (no array shifts) so recording stays O(1) under bursts.
 * - `subscribe` delivers each new event individually so consumers can append
 *   without re-reading the whole buffer; `getRevision` powers `useSyncExternalStore`.
 */

import {DateTime} from "luxon";

import type {SyncMutationOperation} from "../types";

/** Coarse category for an event, mirroring the sync protocol vocabulary. */
export type SyncDebugEventType =
  | "mutate"
  | "delta"
  | "send"
  | "ack"
  | "nack"
  | "retry"
  | "failed"
  | "conflict"
  | "resolve"
  | "reconcile"
  | "replay"
  | "connect"
  | "disconnect";

/** Which way the event flows relative to the device. */
export type SyncDebugDirection = "local" | "inbound" | "outbound" | "system";

/** A single recorded sync event. All fields are JSON-serializable. */
export interface SyncDebugEvent {
  /** Monotonic local id (assigned by the log; stable ordering key). */
  id: number;
  /** ISO-8601 capture time. */
  timestamp: string;
  type: SyncDebugEventType;
  direction: SyncDebugDirection;
  /** Short human-readable summary, e.g. "update todos/abc @4". */
  label: string;
  collection?: string;
  entityId?: string;
  stream?: string;
  mutationId?: string;
  operation?: SyncMutationOperation;
  /** Server seq (deltas, acks) where applicable. */
  seq?: number;
  /** For long-running events (reconcile/replay) split into start/end. */
  phase?: "start" | "end";
  /** Outcome flag: true for ack, false for nack/failed. */
  ok?: boolean;
  /** Wall-clock duration for a phase:"end" event. */
  durationMs?: number;
  /** Extra serializable context (delta data, mutation args, nack code, counts). */
  detail?: Record<string, unknown>;
}

/** Input to `record`; the log fills in `id` and `timestamp`. */
export type SyncDebugRecordInput = Omit<SyncDebugEvent, "id" | "timestamp"> & {
  timestamp?: string;
};

export interface SyncDebugStats {
  /** Events recorded since creation/last clear (including evicted ones). */
  total: number;
  /** Live count of events currently retained in the buffer. */
  retained: number;
  /** Events dropped from the tail because the buffer was full. */
  dropped: number;
  byType: Record<SyncDebugEventType, number>;
  firstEventAt?: string;
  lastEventAt?: string;
}

/** A plain, serializable point-in-time view — the MCP-facing shape. */
export interface SyncDebugSnapshot {
  capacity: number;
  events: SyncDebugEvent[];
  stats: SyncDebugStats;
}

export interface SyncDebugLog {
  /** Max events retained before the oldest are evicted. */
  readonly capacity: number;
  /** Record an event; returns the stored event (with id + timestamp). */
  record: (input: SyncDebugRecordInput) => SyncDebugEvent;
  /** Events in chronological (oldest → newest) order. */
  getEvents: () => SyncDebugEvent[];
  /** Subscribe to each newly recorded event. Returns an unsubscribe fn. */
  subscribe: (listener: (event: SyncDebugEvent) => void) => () => void;
  /** Monotonic revision, bumped on every record and clear (for external stores). */
  getRevision: () => number;
  /** Aggregate counters. */
  getStats: () => SyncDebugStats;
  /** Serializable snapshot (events + stats) — safe to return over MCP. */
  snapshot: () => SyncDebugSnapshot;
  /**
   * Drop all retained events AND reset every derived stat (`total`,
   * `dropped`, `byType`, `firstEventAt`, `lastEventAt`) to match the
   * now-empty buffer — `getStats()` immediately after `clear()` always
   * describes exactly what the log currently holds (nothing), never a
   * lifetime total left over from before the clear. The event id sequence
   * (`nextId`) is the only thing that survives a clear, so ids stay
   * monotonic across it.
   */
  clear: () => void;
}

export interface SyncDebugLogOptions {
  /** Max retained events (default 500). */
  capacity?: number;
  /** ISO clock, injectable for deterministic tests. */
  clock?: () => string;
}

const DEFAULT_CAPACITY = 500;

const emptyByType = (): Record<SyncDebugEventType, number> => ({
  ack: 0,
  conflict: 0,
  connect: 0,
  delta: 0,
  disconnect: 0,
  failed: 0,
  mutate: 0,
  nack: 0,
  reconcile: 0,
  replay: 0,
  resolve: 0,
  retry: 0,
  send: 0,
});

/**
 * Create an in-memory debug log backed by a circular buffer.
 */
export const createSyncDebugLog = (options: SyncDebugLogOptions = {}): SyncDebugLog => {
  const capacity = Math.max(1, options.capacity ?? DEFAULT_CAPACITY);
  const clock = options.clock ?? ((): string => DateTime.now().toISO() ?? new Date().toISOString());

  const buffer: (SyncDebugEvent | undefined)[] = new Array(capacity);
  let writeIndex = 0;
  let retained = 0;
  let nextId = 1;
  let total = 0;
  let dropped = 0;
  let revision = 0;
  const byType = emptyByType();
  let firstEventAt: string | undefined;
  let lastEventAt: string | undefined;
  const listeners = new Set<(event: SyncDebugEvent) => void>();

  const record = (input: SyncDebugRecordInput): SyncDebugEvent => {
    const event: SyncDebugEvent = {
      ...input,
      id: nextId++,
      timestamp: input.timestamp ?? clock(),
    };

    // Evict the slot we are about to overwrite once the buffer is saturated.
    if (retained === capacity) {
      dropped++;
    } else {
      retained++;
    }
    buffer[writeIndex] = event;
    writeIndex = (writeIndex + 1) % capacity;

    total++;
    byType[event.type]++;
    if (!firstEventAt) {
      firstEventAt = event.timestamp;
    }
    lastEventAt = event.timestamp;
    revision++;

    for (const listener of listeners) {
      listener(event);
    }
    return event;
  };

  const getEvents = (): SyncDebugEvent[] => {
    const events: SyncDebugEvent[] = [];
    const start = (writeIndex - retained + capacity) % capacity;
    for (let i = 0; i < retained; i++) {
      const event = buffer[(start + i) % capacity];
      if (event) {
        events.push(event);
      }
    }
    return events;
  };

  const getStats = (): SyncDebugStats => ({
    byType: {...byType},
    dropped,
    firstEventAt,
    lastEventAt,
    retained,
    total,
  });

  const snapshot = (): SyncDebugSnapshot => ({
    capacity,
    events: getEvents(),
    stats: getStats(),
  });

  const subscribe = (listener: (event: SyncDebugEvent) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const clear = (): void => {
    buffer.fill(undefined);
    writeIndex = 0;
    retained = 0;
    // E6: reset every derived stat to match the now-empty buffer, not just
    // `retained` — leaving `total`/`dropped`/`byType`/`firstEventAt`/
    // `lastEventAt` at their pre-clear values produced an incoherent
    // snapshot (e.g. `retained: 0` alongside `byType.mutate: 5` and a
    // `total` that no longer describes anything the log still holds).
    // `nextId` is NOT reset: ids stay monotonic across a clear so a listener
    // that cached an event by id never collides with a later one.
    total = 0;
    dropped = 0;
    for (const type of Object.keys(byType) as SyncDebugEventType[]) {
      byType[type] = 0;
    }
    firstEventAt = undefined;
    lastEventAt = undefined;
    revision++;
  };

  return {
    capacity,
    clear,
    getEvents,
    getRevision: () => revision,
    getStats,
    record,
    snapshot,
    subscribe,
  };
};

/** Resolve a `debug` config value (boolean | options) into a log or undefined. */
export const resolveDebugLog = (
  debug: boolean | SyncDebugLogOptions | undefined
): SyncDebugLog | undefined => {
  if (!debug) {
    return undefined;
  }
  return createSyncDebugLog(debug === true ? {} : debug);
};
