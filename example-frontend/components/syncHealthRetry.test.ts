import {describe, expect, it} from "bun:test";
import type {SyncStatus} from "@terreno/syncdb";

import {
  failedEntityIdsForCollection,
  getRetryBlockedReason,
  nothingToRetryMessage,
  retryBlockedMessage,
  retryFailedMessage,
} from "./syncHealthRetry";

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

describe("failedEntityIdsForCollection", () => {
  it("returns unique failed entity ids for the given collection", () => {
    const ids = failedEntityIdsForCollection({
      collection: "todos",
      outboxRows: {
        a: {collection: "todos", entityId: "e1", status: "failed"},
        b: {collection: "todos", entityId: "e1", status: "failed"},
        c: {collection: "todos", entityId: "e2", status: "queued"},
        d: {collection: "notes", entityId: "e3", status: "failed"},
        e: {collection: "todos", entityId: "e4", status: "failed"},
      },
    });
    expect(ids.sort()).toEqual(["e1", "e4"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(
      failedEntityIdsForCollection({
        collection: "todos",
        outboxRows: {a: {collection: "todos", entityId: "e1", status: "queued"}},
      })
    ).toEqual([]);
  });
});

describe("getRetryBlockedReason", () => {
  it("returns auth when sync is paused for authentication", () => {
    expect(getRetryBlockedReason(buildStatus({paused: "auth"}))).toBe("auth");
  });

  it("returns offline when the client is disconnected", () => {
    expect(getRetryBlockedReason(buildStatus({isOnline: false}))).toBe("offline");
  });

  it("returns null when retry can proceed", () => {
    expect(getRetryBlockedReason(buildStatus())).toBeNull();
  });
});

describe("retry messages", () => {
  it("builds blocked / empty / thrown messages for the toast", () => {
    expect(retryBlockedMessage({label: "Todos", phase: "before", reason: "offline"})).toBe(
      "Couldn't retry Todos — you're offline."
    );
    expect(retryBlockedMessage({label: "Todos", phase: "after", reason: "auth"})).toBe(
      "Retry of Todos paused — sign in again to finish syncing."
    );
    expect(nothingToRetryMessage("Todos")).toBe("Couldn't retry — no failed Todos changes found.");
    expect(retryFailedMessage("Todos")).toBe("Couldn't retry Todos sync");
  });
});
