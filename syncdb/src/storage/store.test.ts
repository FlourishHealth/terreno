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
