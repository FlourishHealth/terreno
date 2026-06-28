import {describe, expect, it} from "bun:test";

import {createSyncStore} from "../storage/store";
import {SYNC_TABLES} from "../storage/types";
import {applyCollectionSnapshot, type CollectionSnapshot} from "./snapshot";

interface TodoData {
  title: string;
}

describe("applyCollectionSnapshot", () => {
  it("merges records, advances the cursor, and applies deletes", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "local-only"}, id: "local"});

    const snapshot: CollectionSnapshot<TodoData> = {
      collection: "todos",
      cursor: "42",
      records: [
        {data: {title: "from server"}, id: "t1", version: "v1"},
        {data: {title: "gone"}, deleted: true, id: "t2"},
      ],
    };

    const result = applyCollectionSnapshot<TodoData>({snapshot, store});

    expect(result).toMatchObject({applied: 2, collection: "todos", cursor: "42", removed: 0});
    expect(store.getEntity<TodoData>({collection: "todos", id: "t1"})?.data.title).toBe(
      "from server"
    );
    // merge keeps local-only rows
    expect(store.getEntity({collection: "todos", id: "local"})).toBeDefined();
    // deleted record is a tombstone (hidden from list reads)
    expect(
      store
        .getCollectionEntities({collection: "todos"})
        .map((e) => e.id)
        .sort()
    ).toEqual(["local", "t1"]);
    // cursor recorded for later delta resume
    expect(store.raw.getCell(SYNC_TABLES.cursors, "todos", "cursor")).toBe("42");
  });

  it("replace mode removes local rows absent from the snapshot", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "stale"}, id: "stale"});
    store.upsertEntity({collection: "todos", data: {title: "keep"}, id: "keep"});

    const result = applyCollectionSnapshot<TodoData>({
      mode: "replace",
      snapshot: {
        collection: "todos",
        records: [{data: {title: "keep-updated"}, id: "keep"}],
      },
      store,
    });

    expect(result.removed).toBe(1);
    expect(store.getEntity({collection: "todos", id: "stale"})).toBeUndefined();
    expect(store.getEntity<TodoData>({collection: "todos", id: "keep"})?.data.title).toBe(
      "keep-updated"
    );
  });

  it("does not regress the cursor when a snapshot supplies an older one", () => {
    const store = createSyncStore();
    applyCollectionSnapshot({snapshot: {collection: "todos", cursor: "10", records: []}, store});

    const result = applyCollectionSnapshot({
      snapshot: {collection: "todos", cursor: "5", records: []},
      store,
    });

    expect(result.cursor).toBe("10");
    expect(store.raw.getCell(SYNC_TABLES.cursors, "todos", "cursor")).toBe("10");
  });

  it("skips ids with pending local edits (merge and replace)", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "my local edit"}, id: "t1"});
    store.upsertEntity({collection: "todos", data: {title: "local-only create"}, id: "t2"});

    const result = applyCollectionSnapshot<TodoData>({
      mode: "replace",
      skipIds: new Set(["t1", "t2"]),
      snapshot: {
        collection: "todos",
        records: [{data: {title: "server wins?"}, id: "t1"}],
      },
      store,
    });

    // t1 not overwritten, t2 not removed despite replace mode.
    expect(store.getEntity<TodoData>({collection: "todos", id: "t1"})?.data.title).toBe(
      "my local edit"
    );
    expect(store.getEntity({collection: "todos", id: "t2"})).toBeDefined();
    expect(result.applied).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("does not touch other collections", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "notes", data: {title: "note"}, id: "n1"});

    applyCollectionSnapshot({
      mode: "replace",
      snapshot: {collection: "todos", records: []},
      store,
    });

    expect(store.getEntity({collection: "notes", id: "n1"})).toBeDefined();
  });
});
