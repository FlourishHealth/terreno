import {describe, expect, it} from "bun:test";
import type {SyncCollectionStatus, SyncStatus} from "@terreno/syncdb";

import {
  collectionToastId,
  computeHealthSignals,
  GLOBAL_TOAST_ID,
  OUT_OF_SYNC_QUEUE_THRESHOLD,
} from "./syncHealthSignals";

const buildStatus = (overrides?: Partial<SyncStatus>): SyncStatus => ({
  blockedEntities: 0,
  collections: {},
  conflictCount: 0,
  draining: false,
  failedCount: 0,
  isOnline: true,
  isSyncing: false,
  persistence: "durable",
  queuedCount: 0,
  sentThisDrain: 0,
  streams: {},
  totalThisDrain: 0,
  ...overrides,
});

const buildCounts = (overrides?: Partial<SyncCollectionStatus>): SyncCollectionStatus => ({
  conflictCount: 0,
  failedCount: 0,
  queuedCount: 0,
  ...overrides,
});

const compute = (status: SyncStatus, canOpenConflicts = true) =>
  computeHealthSignals({
    canOpenConflicts,
    collectionLabels: {},
    conflictsSubtitle: "Tap Resolve to review and fix conflicts.",
    resolveButtonText: "Resolve",
    retryButtonText: "Retry",
    retrySubtitle: "Tap Retry to try syncing those changes again.",
    status,
  });

describe("computeHealthSignals", () => {
  it("produces no signals when everything is healthy", () => {
    expect(compute(buildStatus())).toEqual([]);
  });

  it("emits exactly one signal per unhealthy collection, naming the collection", () => {
    const signals = compute(
      buildStatus({
        collections: {
          notes: buildCounts({failedCount: 2}),
          todos: buildCounts({conflictCount: 1, failedCount: 1}),
        },
      })
    );

    expect(signals).toHaveLength(2);
    expect(signals.map((signal) => signal.id)).toEqual([
      collectionToastId("notes"),
      collectionToastId("todos"),
    ]);
    expect(signals[0].message).toBe("Notes sync needs attention: 2 failed changes");
    expect(signals[1].message).toBe("Todos sync needs attention: 1 conflict · 1 failed change");
  });

  it("gives each collection a distinct toast id so they never collide", () => {
    const signals = compute(
      buildStatus({
        collections: {
          notes: buildCounts({conflictCount: 1}),
          todos: buildCounts({conflictCount: 1}),
        },
      })
    );
    expect(new Set(signals.map((signal) => signal.id)).size).toBe(signals.length);
  });

  it("omits healthy collections even when others need attention", () => {
    const signals = compute(
      buildStatus({
        collections: {
          notes: buildCounts({queuedCount: 3}),
          todos: buildCounts({conflictCount: 1}),
        },
      })
    );
    expect(signals.map((signal) => signal.collection)).toEqual(["todos"]);
  });

  it("offers Resolve for conflicts and Retry for failed-only collections", () => {
    const conflicted = buildStatus({collections: {todos: buildCounts({conflictCount: 1})}});
    expect(compute(conflicted)[0]).toMatchObject({
      action: "resolveConflicts",
      buttonText: "Resolve",
      collection: "todos",
      subtitle: "Tap Resolve to review and fix conflicts.",
    });

    const withoutModal = compute(conflicted, false)[0];
    expect(withoutModal.buttonText).toBeUndefined();
    expect(withoutModal.collection).toBeUndefined();
    expect(withoutModal.action).toBeUndefined();

    const failedOnly = compute(
      buildStatus({collections: {todos: buildCounts({failedCount: 1})}})
    )[0];
    expect(failedOnly).toMatchObject({
      action: "retryFailed",
      buttonText: "Retry",
      collection: "todos",
      subtitle: "Tap Retry to try syncing those changes again.",
    });

    // Conflicts take priority when both are present — resolving unblocks the queue.
    const both = compute(
      buildStatus({collections: {todos: buildCounts({conflictCount: 1, failedCount: 2})}})
    )[0];
    expect(both).toMatchObject({
      action: "resolveConflicts",
      buttonText: "Resolve",
    });
  });

  it("changes the signal key when the counts change so the toast is refreshed", () => {
    const [before] = compute(buildStatus({collections: {todos: buildCounts({conflictCount: 1})}}));
    const [after] = compute(buildStatus({collections: {todos: buildCounts({conflictCount: 2})}}));
    expect(before.id).toBe(after.id);
    expect(before.key).not.toBe(after.key);
  });

  it("adds a single global backlog signal while offline, alongside collection signals", () => {
    const signals = compute(
      buildStatus({
        collections: {todos: buildCounts({conflictCount: 1, queuedCount: 4})},
        isOnline: false,
        queuedCount: 4,
      })
    );

    expect(signals).toHaveLength(2);
    expect(signals[1]).toMatchObject({
      id: GLOBAL_TOAST_ID,
      message: "Offline — 4 changes waiting to sync",
      variant: "info",
    });
  });

  it("warns about a stalled backlog only once the queue passes the threshold", () => {
    expect(compute(buildStatus({queuedCount: OUT_OF_SYNC_QUEUE_THRESHOLD - 1}))).toEqual([]);

    const [signal] = compute(buildStatus({queuedCount: OUT_OF_SYNC_QUEUE_THRESHOLD}));
    expect(signal).toMatchObject({
      id: GLOBAL_TOAST_ID,
      message: `Sync is falling behind — ${OUT_OF_SYNC_QUEUE_THRESHOLD} changes queued`,
      variant: "warning",
    });
  });

  it("prefers a caller-supplied collection label over the capitalized name", () => {
    const [signal] = computeHealthSignals({
      canOpenConflicts: true,
      collectionLabels: {todos: "To-dos"},
      conflictsSubtitle: "Tap Resolve to review and fix conflicts.",
      resolveButtonText: "Resolve",
      retryButtonText: "Retry",
      retrySubtitle: "Tap Retry to try syncing those changes again.",
      status: buildStatus({collections: {todos: buildCounts({conflictCount: 1})}}),
    });
    expect(signal.message).toBe("To-dos sync needs attention: 1 conflict");
  });

  it("tolerates a status without a collections breakdown", () => {
    const status = buildStatus({queuedCount: 0});
    delete (status as Partial<SyncStatus>).collections;
    expect(compute(status)).toEqual([]);
  });
});
