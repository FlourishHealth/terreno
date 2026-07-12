import {describe, expect, it} from "bun:test";

import {SYNC_SCHEMA_VERSION} from "./schema";
import {createSyncStore} from "./store";
import {CONFLICTS_TABLE, CURSORS_TABLE, OUTBOX_TABLE} from "./types";

interface Todo {
  completed: boolean;
  title: string;
}

const makeStore = () => createSyncStore({collections: ["todos", "notes"]});

describe("createSyncStore", () => {
  it("throws when a collection name starts with the reserved prefix", () => {
    expect(() => createSyncStore({collections: ["_outbox"]})).toThrow(/must not start with "_"/);
    expect(() => createSyncStore({collections: ["todos", "_shadow"]})).toThrow(/_shadow/);
  });

  it("throws on duplicate collection names", () => {
    expect(() => createSyncStore({collections: ["todos", "todos"]})).toThrow(/Duplicate/);
  });

  it("exposes the configured collections and a raw MergeableStore", () => {
    const store = makeStore();
    expect(store.collections).toEqual(["todos", "notes"]);
    expect(typeof store.raw.getMergeableContent).toBe("function");
  });

  it("initializes schemaVersion and an empty lastUserId", () => {
    const store = makeStore();
    expect(store.getSchemaVersion()).toBe(SYNC_SCHEMA_VERSION);
    expect(store.getLastUserId()).toBeUndefined();
  });

  it("round-trips lastUserId", () => {
    const store = makeStore();
    store.setLastUserId({userId: "user-1"});
    expect(store.getLastUserId()).toBe("user-1");
  });
});

describe("upsertEntity / getEntity", () => {
  it("round-trips entity data through the JSON data cell", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {completed: false, title: "Buy milk"},
      id: "t1",
      seq: 3,
    });
    const entity = store.getEntity<Todo>({collection: "todos", id: "t1"});
    expect(entity).toEqual({
      data: {completed: false, title: "Buy milk"},
      deleted: false,
      id: "t1",
      pendingMutationId: undefined,
      seq: 3,
      stream: undefined,
    });
  });

  it("returns undefined for a missing entity", () => {
    const store = makeStore();
    expect(store.getEntity({collection: "todos", id: "nope"})).toBeUndefined();
  });

  it("defaults seq to 0 and deleted to false for new local entities", () => {
    const store = makeStore();
    const entity = store.upsertEntity({collection: "todos", data: {title: "Local"}, id: "t1"});
    expect(entity.seq).toBe(0);
    expect(entity.deleted).toBe(false);
    expect(entity.pendingMutationId).toBeUndefined();
  });

  it("preserves existing seq, deleted, and pendingMutationId when omitted", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "v1"},
      deleted: true,
      id: "t1",
      pendingMutationId: "m1",
      seq: 7,
    });
    const updated = store.upsertEntity({collection: "todos", data: {title: "v2"}, id: "t1"});
    expect(updated.seq).toBe(7);
    expect(updated.deleted).toBe(true);
    expect(updated.pendingMutationId).toBe("m1");
  });

  it("clears pendingMutationId when explicitly set to empty", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "v1"},
      id: "t1",
      pendingMutationId: "m1",
    });
    store.upsertEntity({collection: "todos", data: {title: "v2"}, id: "t1", pendingMutationId: ""});
    expect(store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId).toBeUndefined();
  });

  it("stores null data payloads", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: null, id: "t1"});
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toBeNull();
  });

  it("returns null data for a corrupt (non-JSON) data cell instead of throwing", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "ok"}, id: "t1"});
    store.raw.setCell("todos", "t1", "data", "{not json");
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toBeNull();
  });

  it("throws for an unknown collection", () => {
    const store = makeStore();
    expect(() => store.upsertEntity({collection: "nope", data: {}, id: "x"})).toThrow(
      /Unknown collection "nope"/
    );
    expect(() => store.getEntity({collection: "nope", id: "x"})).toThrow(/Unknown collection/);
  });
});

describe("listEntities", () => {
  it("lists entities in a collection", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.upsertEntity({collection: "todos", data: {title: "b"}, id: "t2"});
    const entities = store.listEntities<Todo>({collection: "todos"});
    expect(entities.map((entity) => entity.id).sort()).toEqual(["t1", "t2"]);
  });

  it("excludes tombstones by default and includes them on request", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "live"}, id: "t1"});
    store.upsertEntity({collection: "todos", data: {title: "dead"}, deleted: true, id: "t2"});
    expect(store.listEntities({collection: "todos"}).map((entity) => entity.id)).toEqual(["t1"]);
    expect(
      store
        .listEntities({collection: "todos", includeDeleted: true})
        .map((entity) => entity.id)
        .sort()
    ).toEqual(["t1", "t2"]);
  });

  it("isolates collections from each other, even with the same entity id", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "todo"}, id: "shared"});
    store.upsertEntity({collection: "notes", data: {body: "note"}, id: "shared"});
    expect(store.listEntities({collection: "todos"})).toHaveLength(1);
    expect(store.getEntity({collection: "todos", id: "shared"})?.data).toEqual({title: "todo"});
    expect(store.getEntity({collection: "notes", id: "shared"})?.data).toEqual({body: "note"});
  });

  it("throws for an unknown collection", () => {
    const store = makeStore();
    expect(() => store.listEntities({collection: "nope"})).toThrow(/Unknown collection/);
  });
});

describe("softDeleteEntity", () => {
  it("marks the entity deleted while keeping its data and seq", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "keep me"}, id: "t1", seq: 4});
    store.softDeleteEntity({collection: "todos", id: "t1"});
    const entity = store.getEntity<Todo>({collection: "todos", id: "t1"});
    expect(entity?.deleted).toBe(true);
    expect(entity?.data).toEqual({title: "keep me"} as Todo);
    expect(entity?.seq).toBe(4);
  });

  it("is a no-op for a missing entity", () => {
    const store = makeStore();
    store.softDeleteEntity({collection: "todos", id: "nope"});
    expect(store.getEntity({collection: "todos", id: "nope"})).toBeUndefined();
  });

  it("throws for an unknown collection", () => {
    const store = makeStore();
    expect(() => store.softDeleteEntity({collection: "nope", id: "x"})).toThrow(
      /Unknown collection/
    );
  });
});

describe("clearCollection", () => {
  it("removes every entity in the collection but leaves other tables alone", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.upsertEntity({collection: "notes", data: {body: "b"}, id: "n1"});
    store.clearCollection({collection: "todos"});
    expect(store.listEntities({collection: "todos", includeDeleted: true})).toHaveLength(0);
    expect(store.listEntities({collection: "notes"})).toHaveLength(1);
  });

  it("throws for an unknown collection", () => {
    const store = makeStore();
    expect(() => store.clearCollection({collection: "nope"})).toThrow(/Unknown collection/);
  });

  it("cannot be used to clear reserved tables", () => {
    const store = makeStore();
    expect(() => store.clearCollection({collection: OUTBOX_TABLE})).toThrow(/Unknown collection/);
    expect(() => store.clearCollection({collection: CURSORS_TABLE})).toThrow(/Unknown collection/);
    expect(() => store.clearCollection({collection: CONFLICTS_TABLE})).toThrow(
      /Unknown collection/
    );
  });
});

describe("deletedAt stamping (E5)", () => {
  it("upsertEntity stamps deletedAt on the transition into a tombstone, and only then", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    expect(store.getEntity({collection: "todos", id: "t1"})?.deletedAt).toBeUndefined();

    store.softDeleteEntity({collection: "todos", id: "t1"});
    const firstStampedAt = store.getEntity({collection: "todos", id: "t1"})?.deletedAt;
    expect(firstStampedAt).toBeTruthy();

    // A second upsert that keeps deleted: true must NOT re-stamp deletedAt.
    store.upsertEntity({collection: "todos", data: {title: "a"}, deleted: true, id: "t1"});
    expect(store.getEntity({collection: "todos", id: "t1"})?.deletedAt).toBe(firstStampedAt);
  });

  it("clears deletedAt on a resurrection (upsert back to deleted: false)", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.softDeleteEntity({collection: "todos", id: "t1"});
    expect(store.getEntity({collection: "todos", id: "t1"})?.deletedAt).toBeTruthy();

    store.upsertEntity({collection: "todos", data: {title: "a"}, deleted: false, id: "t1"});
    expect(store.getEntity({collection: "todos", id: "t1"})?.deletedAt).toBeUndefined();
  });
});

describe("compactTombstones (E5)", () => {
  it("removes tombstones older than the retention window, across all collections", () => {
    const clock = {value: 1_000_000};
    const store = createSyncStore({
      collections: ["todos", "notes"],
      now: () => new Date(clock.value).toISOString(),
    });
    store.upsertEntity({collection: "todos", data: {title: "old"}, id: "t1"});
    store.upsertEntity({collection: "todos", data: {title: "recent"}, id: "t2"});
    store.upsertEntity({collection: "notes", data: {body: "old note"}, id: "n1"});
    store.upsertEntity({collection: "todos", data: {title: "kept, not deleted"}, id: "t3"});

    // t1/n1 tombstoned "long ago"; t2 tombstoned "recently", relative to the
    // clock the compaction call itself uses below.
    store.upsertEntity({collection: "todos", data: null, deleted: true, id: "t1"});
    store.upsertEntity({collection: "notes", data: null, deleted: true, id: "n1"});
    clock.value += 100 * 24 * 60 * 60 * 1_000; // +100 days
    store.upsertEntity({collection: "todos", data: null, deleted: true, id: "t2"});

    // Advance the clock another 10 days: t1/n1 are now ~110 days old, t2 is
    // ~10 days old. A 90-day retention window compacts t1/n1 but keeps t2.
    clock.value += 10 * 24 * 60 * 60 * 1_000;
    const result = store.compactTombstones({olderThanMs: 90 * 24 * 60 * 60 * 1_000});

    expect(result.removed).toBe(2);
    expect(store.getEntity({collection: "todos", id: "t1"})).toBeUndefined();
    expect(store.getEntity({collection: "notes", id: "n1"})).toBeUndefined();
    expect(store.getEntity({collection: "todos", id: "t2"})?.deleted).toBe(true);
    expect(store.getEntity({collection: "todos", id: "t3"})?.deleted).toBe(false);
  });

  it("leaves tombstones with no deletedAt (pre-E5 rows) untouched", () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "legacy"}, id: "t1"});
    // Simulate a tombstone written before deletedAt existed: set the cell
    // directly, bypassing the stamping logic in upsertEntity/softDeleteEntity.
    store.raw.setCell("todos", "t1", "deleted", true);
    expect(store.getEntity({collection: "todos", id: "t1"})?.deletedAt).toBeUndefined();

    const result = store.compactTombstones({olderThanMs: 0});
    expect(result.removed).toBe(0);
    expect(store.getEntity({collection: "todos", id: "t1"})).toBeDefined();
  });

  it("never removes non-tombstone rows regardless of age", () => {
    const store = makeStore();
    const clock = {value: 1_000_000};
    store.upsertEntity({collection: "todos", data: {title: "alive"}, id: "t1"});
    const result = store.compactTombstones({
      now: () => new Date(clock.value + 1_000 * 60 * 60 * 24 * 365).toISOString(),
      olderThanMs: 0,
    });
    expect(result.removed).toBe(0);
    expect(store.getEntity({collection: "todos", id: "t1"})).toBeDefined();
  });
});

describe("known streams + purgeStream (C2)", () => {
  it("round-trips known streams (add / get / remove)", () => {
    const store = makeStore();
    expect(store.getKnownStreams()).toEqual([]);
    store.addKnownStream({collection: "todos", stream: "todos|owner:u1"});
    store.addKnownStream({collection: "todos", stream: "todos|tenant:org1"});
    expect(store.getKnownStreams().sort()).toEqual(["todos|owner:u1", "todos|tenant:org1"]);
    store.removeKnownStream({stream: "todos|owner:u1"});
    expect(store.getKnownStreams()).toEqual(["todos|tenant:org1"]);
  });

  it("purgeStream deletes only the matching stream's entities, its cursor, and its known-stream row", () => {
    const store = makeStore();
    const leaving = "todos|tenant:org1";
    const staying = "todos|owner:u1";
    // Two entities on the leaving stream (one in each collection), one on the staying stream.
    store.upsertEntity({collection: "todos", data: {t: 1}, id: "a", seq: 3, stream: leaving});
    store.upsertEntity({collection: "notes", data: {n: 1}, id: "b", seq: 4, stream: leaving});
    store.upsertEntity({collection: "todos", data: {t: 2}, id: "c", seq: 5, stream: staying});
    store.addKnownStream({collection: "todos", stream: leaving});
    store.addKnownStream({collection: "todos", stream: staying});
    store.raw.setRow(CURSORS_TABLE, leaving, {seq: 3, updatedAt: "x"});
    store.raw.setRow(CURSORS_TABLE, staying, {seq: 5, updatedAt: "y"});

    const purged = store.purgeStream({stream: leaving});

    expect(purged).toBe(2);
    expect(store.getEntity({collection: "todos", id: "a"})).toBeUndefined();
    expect(store.getEntity({collection: "notes", id: "b"})).toBeUndefined();
    // The staying stream's entity and cursor and known-stream row are untouched.
    expect(store.getEntity({collection: "todos", id: "c"})?.data).toEqual({t: 2});
    expect(store.raw.getCell(CURSORS_TABLE, staying, "seq")).toBe(5);
    expect(store.raw.hasRow(CURSORS_TABLE, leaving)).toBe(false);
    expect(store.getKnownStreams()).toEqual([staying]);
  });

  it("purgeStream returns 0 and is a no-op for a stream with no entities", () => {
    const store = makeStore();
    store.addKnownStream({collection: "todos", stream: "todos|owner:ghost"});
    expect(store.purgeStream({stream: "todos|owner:ghost"})).toBe(0);
    expect(store.getKnownStreams()).toEqual([]);
  });
});
