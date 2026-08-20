import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import {CURSORS_TABLE} from "../storage/types";
import {getAllCursors, getCursor, setCursor} from "./cursor";

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

describe("getCursor", () => {
  it("returns 0 for a stream that has never synced", () => {
    const store = makeStore();
    expect(getCursor({store, stream: "todos|owner:u1"})).toBe(0);
  });

  it("returns the stored seq", () => {
    const store = makeStore();
    setCursor({seq: 5, store, stream: "todos|owner:u1"});
    expect(getCursor({store, stream: "todos|owner:u1"})).toBe(5);
  });
});

describe("setCursor", () => {
  it("advances monotonically and stamps updatedAt with the injected clock", () => {
    const store = makeStore();
    setCursor({now: () => "2026-07-04T00:00:00Z", seq: 3, store, stream: "s1"});
    expect(store.raw.getCell(CURSORS_TABLE, "s1", "updatedAt")).toBe("2026-07-04T00:00:00Z");
    setCursor({now: () => "2026-07-04T00:00:01Z", seq: 8, store, stream: "s1"});
    expect(getCursor({store, stream: "s1"})).toBe(8);
    expect(store.raw.getCell(CURSORS_TABLE, "s1", "updatedAt")).toBe("2026-07-04T00:00:01Z");
  });

  it("never moves backwards", () => {
    const store = makeStore();
    setCursor({now: () => "t1", seq: 8, store, stream: "s1"});
    setCursor({now: () => "t2", seq: 3, store, stream: "s1"});
    expect(getCursor({store, stream: "s1"})).toBe(8);
    expect(store.raw.getCell(CURSORS_TABLE, "s1", "updatedAt")).toBe("t1");
  });

  it("ignores an equal seq (no updatedAt churn)", () => {
    const store = makeStore();
    setCursor({now: () => "t1", seq: 8, store, stream: "s1"});
    setCursor({now: () => "t2", seq: 8, store, stream: "s1"});
    expect(store.raw.getCell(CURSORS_TABLE, "s1", "updatedAt")).toBe("t1");
  });

  it("ignores a non-positive seq for a fresh stream", () => {
    const store = makeStore();
    setCursor({seq: 0, store, stream: "s1"});
    expect(getAllCursors({store})).toEqual({});
  });

  it("defaults updatedAt to a real ISO timestamp when no clock is injected", () => {
    const store = makeStore();
    setCursor({seq: 1, store, stream: "s1"});
    const updatedAt = store.raw.getCell(CURSORS_TABLE, "s1", "updatedAt");
    expect(typeof updatedAt).toBe("string");
    expect(String(updatedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("getAllCursors", () => {
  it("returns every stream's cursor", () => {
    const store = makeStore();
    setCursor({seq: 2, store, stream: "todos|owner:u1"});
    setCursor({seq: 9, store, stream: "notes|tenant:org1"});
    expect(getAllCursors({store})).toEqual({
      "notes|tenant:org1": 9,
      "todos|owner:u1": 2,
    });
  });

  it("returns an empty record for a fresh store", () => {
    expect(getAllCursors({store: makeStore()})).toEqual({});
  });

  it("keeps cursors independent per stream", () => {
    const store = makeStore();
    setCursor({seq: 5, store, stream: "a"});
    setCursor({seq: 2, store, stream: "b"});
    expect(getCursor({store, stream: "a"})).toBe(5);
    expect(getCursor({store, stream: "b"})).toBe(2);
  });
});
