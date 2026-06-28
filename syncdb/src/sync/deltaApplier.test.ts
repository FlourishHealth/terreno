import {describe, expect, it} from "bun:test";

import {createSyncStore} from "../storage/store";
import {createDeltaApplier} from "./deltaApplier";
import type {SyncDeltaEvent} from "./types";

const deltaEvent = (cursor: string, changes: SyncDeltaEvent["changes"]): SyncDeltaEvent => ({
  changes,
  cursor,
  stream: "todos",
  type: "sync:delta",
});

describe("createDeltaApplier", () => {
  it("applies an ordered upsert delta and advances the cursor", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});

    const result = applier.apply(
      deltaEvent("1", [
        {
          collection: "todos",
          data: {title: "Delta task"},
          entityId: "t1",
          op: "upsert",
          version: "v1",
        },
      ])
    );

    expect(result.skipped).toBe(false);
    expect(result.applied).toBe(1);
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "Delta task"});
    expect(applier.getCursor({stream: "todos"})).toBe("1");
  });

  it("is idempotent: a duplicate delta does not double-apply", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    const event = deltaEvent("1", [
      {
        collection: "todos",
        data: {title: "Delta task"},
        entityId: "t1",
        op: "upsert",
        version: "v1",
      },
    ]);

    applier.apply(event);
    const second = applier.apply(event);

    expect(second.skipped).toBe(true);
    expect(store.getCollectionEntities({collection: "todos"})).toHaveLength(1);
  });

  it("skips out-of-order (older cursor) deltas", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    applier.apply(
      deltaEvent("5", [{collection: "todos", data: {n: 5}, entityId: "t1", op: "upsert"}])
    );

    const stale = applier.apply(
      deltaEvent("3", [{collection: "todos", data: {n: 3}, entityId: "t1", op: "upsert"}])
    );

    expect(stale.skipped).toBe(true);
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({n: 5});
    expect(applier.getCursor({stream: "todos"})).toBe("5");
  });

  it("skips a change whose version already matches the local entity", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    applier.apply(
      deltaEvent("1", [
        {collection: "todos", data: {title: "v1"}, entityId: "t1", op: "upsert", version: "v1"},
      ])
    );

    const result = applier.apply(
      deltaEvent("2", [
        {
          collection: "todos",
          data: {title: "changed"},
          entityId: "t1",
          op: "upsert",
          version: "v1",
        },
      ])
    );

    expect(result.applied).toBe(0);
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "v1"});
    expect(applier.getCursor({stream: "todos"})).toBe("2");
  });

  it("applies delete changes as soft deletes", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    store.upsertEntity({collection: "todos", data: {title: "x"}, id: "t1"});

    applier.apply(deltaEvent("1", [{collection: "todos", entityId: "t1", op: "delete"}]));

    expect(store.getCollectionEntities({collection: "todos"})).toEqual([]);
    expect(store.getEntity({collection: "todos", id: "t1"})?.deleted).toBe(true);
  });

  it("orders multi-digit numeric cursors numerically (10 > 9)", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    applier.apply(
      deltaEvent("9", [{collection: "todos", data: {n: 9}, entityId: "t1", op: "upsert"}])
    );

    const newer = applier.apply(
      deltaEvent("10", [{collection: "todos", data: {n: 10}, entityId: "t1", op: "upsert"}])
    );
    expect(newer.skipped).toBe(false);
    expect(applier.getCursor({stream: "todos"})).toBe("10");
  });

  it("compares non-numeric cursors lexicographically", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    applier.apply(
      deltaEvent("a", [{collection: "todos", data: {n: 1}, entityId: "t1", op: "upsert"}])
    );

    const older = applier.apply(
      deltaEvent("a", [{collection: "todos", data: {n: 2}, entityId: "t1", op: "upsert"}])
    );
    expect(older.skipped).toBe(true);

    const newer = applier.apply(
      deltaEvent("b", [{collection: "todos", data: {n: 3}, entityId: "t1", op: "upsert"}])
    );
    expect(newer.skipped).toBe(false);
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({n: 3});
  });

  it("applies a partial batch, counting only non-skipped changes", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    applier.apply(
      deltaEvent("1", [
        {collection: "todos", data: {t: "a"}, entityId: "t1", op: "upsert", version: "v1"},
      ])
    );

    const result = applier.apply(
      deltaEvent("2", [
        {collection: "todos", data: {t: "stale"}, entityId: "t1", op: "upsert", version: "v1"},
        {collection: "todos", data: {t: "b"}, entityId: "t2", op: "upsert", version: "v1"},
      ])
    );
    expect(result.applied).toBe(1);
  });

  it("counts a delete of a missing entity as not applied", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    const result = applier.apply(
      deltaEvent("1", [{collection: "todos", entityId: "ghost", op: "delete"}])
    );
    expect(result.applied).toBe(0);
  });

  it("tracks cursors independently per stream", () => {
    const store = createSyncStore();
    const applier = createDeltaApplier({store});
    applier.apply(
      deltaEvent("10", [{collection: "todos", data: {}, entityId: "t1", op: "upsert"}])
    );
    applier.apply({
      changes: [{collection: "notes", data: {}, entityId: "n1", op: "upsert"}],
      cursor: "2",
      stream: "notes",
      type: "sync:delta",
    });

    expect(applier.getCursor({stream: "todos"})).toBe("10");
    expect(applier.getCursor({stream: "notes"})).toBe("2");
  });
});
