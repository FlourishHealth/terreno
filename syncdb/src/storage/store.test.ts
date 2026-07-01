import {describe, expect, it} from "bun:test";
import {DateTime} from "luxon";

import {createSyncStore, entityKey} from "./store";

interface TodoData {
  title: string;
  completed: boolean;
}

describe("entityKey", () => {
  it("builds a composite collection:id key", () => {
    expect(entityKey({collection: "todos", id: "abc"})).toBe("todos:abc");
  });
});

describe("createSyncStore", () => {
  it("starts empty for a collection", () => {
    const store = createSyncStore();
    expect(store.getCollectionEntities({collection: "todos"})).toEqual([]);
    expect(store.getEntity({collection: "todos", id: "missing"})).toBeUndefined();
  });

  it("upserts and reads back a decoded entity", () => {
    const store = createSyncStore();
    const record = store.upsertEntity<TodoData>({
      collection: "todos",
      data: {completed: false, title: "Buy milk"},
      id: "t1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(record.key).toBe("todos:t1");
    expect(record.data.title).toBe("Buy milk");
    expect(record.deleted).toBe(false);

    const fetched = store.getEntity<TodoData>({collection: "todos", id: "t1"});
    expect(fetched?.data).toEqual({completed: false, title: "Buy milk"});
    expect(fetched?.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("overwrites data on repeated upsert of the same key", () => {
    const store = createSyncStore();
    store.upsertEntity<TodoData>({
      collection: "todos",
      data: {completed: false, title: "v1"},
      id: "t1",
    });
    store.upsertEntity<TodoData>({
      collection: "todos",
      data: {completed: true, title: "v2"},
      id: "t1",
    });

    const fetched = store.getEntity<TodoData>({collection: "todos", id: "t1"});
    expect(fetched?.data).toEqual({completed: true, title: "v2"});
    expect(store.getCollectionEntities({collection: "todos"})).toHaveLength(1);
  });

  it("lists only entities for the requested collection", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.upsertEntity({collection: "todos", data: {title: "b"}, id: "t2"});
    store.upsertEntity({collection: "notes", data: {title: "c"}, id: "n1"});

    const todos = store.getCollectionEntities({collection: "todos"});
    expect(todos.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
  });

  it("soft-deletes by default and hides tombstones from list reads", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.deleteEntity({collection: "todos", id: "t1"});

    expect(store.getCollectionEntities({collection: "todos"})).toEqual([]);
    const tombstone = store.getEntity({collection: "todos", id: "t1"});
    expect(tombstone?.deleted).toBe(true);

    const withDeleted = store.getCollectionEntities({
      collection: "todos",
      includeDeleted: true,
    });
    expect(withDeleted).toHaveLength(1);
  });

  it("hard-deletes by removing the row entirely", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.deleteEntity({collection: "todos", hard: true, id: "t1"});

    expect(store.getEntity({collection: "todos", id: "t1"})).toBeUndefined();
  });

  it("clears all entities", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.upsertEntity({collection: "notes", data: {title: "b"}, id: "n1"});
    store.clear();

    expect(store.getCollectionEntities({collection: "todos"})).toEqual([]);
    expect(store.getCollectionEntities({collection: "notes"})).toEqual([]);
  });

  it("round-trips an explicit version and reads empty version back as undefined", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1", version: "v1"});
    store.upsertEntity({collection: "todos", data: {title: "b"}, id: "t2"});

    expect(store.getEntity({collection: "todos", id: "t1"})?.version).toBe("v1");
    expect(store.getEntity({collection: "todos", id: "t2"})?.version).toBeUndefined();
  });

  it("generates a valid ISO updatedAt when none is provided", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});

    const updatedAt = store.getEntity({collection: "todos", id: "t1"})?.updatedAt ?? "";
    expect(DateTime.fromISO(updatedAt).isValid).toBe(true);
  });

  it("soft delete bumps updatedAt", () => {
    const store = createSyncStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "a"},
      id: "t1",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    store.deleteEntity({collection: "todos", id: "t1"});

    const tombstone = store.getEntity({collection: "todos", id: "t1"});
    expect(tombstone?.updatedAt).not.toBe("2020-01-01T00:00:00.000Z");
    expect(DateTime.fromISO(tombstone?.updatedAt ?? "").isValid).toBe(true);
  });

  it("soft-deleting a missing entity is a harmless no-op", () => {
    const store = createSyncStore();
    expect(() => store.deleteEntity({collection: "todos", id: "missing"})).not.toThrow();
    expect(store.getEntity({collection: "todos", id: "missing"})).toBeUndefined();
  });

  it("recovers from a corrupt payload by returning an empty object", () => {
    const store = createSyncStore();
    store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    store.raw.setCell("entities", "todos:t1", "data", "{not valid json");

    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({});
  });
});
