import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import type {SyncSnapshotResponse} from "../types";
import {type BootstrapProgress, bootstrapStream} from "./bootstrap";
import {getCursor, setCursor} from "./cursor";
import type {FetchSnapshotPageArgs} from "./httpChannel";

const STREAM = "todos|owner:u1";

const makeStore = (): SyncStore => createSyncStore({collections: ["notes", "todos"]});

/**
 * Build a snapshot page with the C1/C7 fields defaulted so tests only specify what they
 * care about. `frontierSeq` defaults to the page cursor (fully committed), and
 * `oldestRetainedSeq` to 0 (no retention gap).
 */
const page = (
  overrides: Partial<SyncSnapshotResponse> & {cursor: number}
): SyncSnapshotResponse => ({
  entities: [],
  frontierSeq: overrides.frontierSeq ?? overrides.cursor,
  hasMore: false,
  oldestRetainedSeq: 0,
  stream: STREAM,
  ...overrides,
});

/**
 * Channel stub serving canned pages for a single stream. Seq pages are keyed by the
 * request cursor (as a string); legacy-stratum pages are keyed `legacy:{token}` where the
 * first request (cursor 0, no legacyCursor) maps to `legacy:start`.
 */
const makeChannel = (
  byKey: Record<string, SyncSnapshotResponse>
): {
  fetchSnapshotPage: (args: FetchSnapshotPageArgs) => Promise<SyncSnapshotResponse>;
  calls: FetchSnapshotPageArgs[];
} => {
  const calls: FetchSnapshotPageArgs[] = [];
  return {
    calls,
    fetchSnapshotPage: async (args: FetchSnapshotPageArgs): Promise<SyncSnapshotResponse> => {
      calls.push({...args});
      const key =
        args.legacyCursor !== undefined
          ? `legacy:${args.legacyCursor}`
          : args.cursor === 0 && byKey["legacy:start"]
            ? "legacy:start"
            : String(args.cursor);
      const canned = byKey[key];
      if (!canned) {
        throw new Error(`No canned page for key ${key} (cursor=${args.cursor})`);
      }
      return canned;
    },
  };
};

describe("bootstrapStream", () => {
  it("pages a stream to completion and advances the real stream cursor", async () => {
    const store = makeStore();
    const channel = makeChannel({
      0: page({
        cursor: 2,
        entities: [
          {data: {title: "a"}, deleted: false, id: "t1", seq: 1},
          {data: {title: "b"}, deleted: false, id: "t2", seq: 2},
        ],
        frontierSeq: 3,
        hasMore: true,
      }),
      2: page({
        cursor: 3,
        entities: [{data: {title: "c"}, deleted: true, id: "t3", seq: 3}],
        frontierSeq: 3,
        hasMore: false,
      }),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});

    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "a"});
    expect(store.getEntity({collection: "todos", id: "t2"})?.seq).toBe(2);
    expect(store.getEntity({collection: "todos", id: "t3"})?.deleted).toBe(true);
    // Entities record the stream they were bootstrapped under (for leave-purge).
    expect(store.getEntity({collection: "todos", id: "t1"})?.stream).toBe(STREAM);
    expect(getCursor({store, stream: STREAM})).toBe(3);
    expect(channel.calls.map((call) => call.cursor)).toEqual([0, 2]);
    expect(channel.calls.every((call) => call.stream === STREAM)).toBe(true);
  });

  it("resumes from the persisted per-stream cursor", async () => {
    const store = makeStore();
    setCursor({seq: 10, store, stream: STREAM});
    const channel = makeChannel({10: page({cursor: 10, entities: [], frontierSeq: 10})});
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    expect(channel.calls).toEqual([
      {cursor: 10, legacyCursor: undefined, limit: undefined, stream: STREAM},
    ]);
  });

  it("C1: never advances the cursor past the stable frontier", async () => {
    const store = makeStore();
    // Server returns one committed entity; the frontier equals it. The next seq's owning
    // write is still in-flight (hasMore false → nothing more to fetch right now).
    const channel = makeChannel({
      0: page({
        cursor: 1,
        entities: [{data: {title: "a"}, deleted: false, id: "t1", seq: 1}],
        frontierSeq: 1,
        hasMore: false,
      }),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    expect(getCursor({store, stream: STREAM})).toBe(1);
  });

  it("C1: clamps a cursor a buggy server reports above its own frontier", async () => {
    const store = makeStore();
    const channel = makeChannel({
      0: page({
        cursor: 9,
        entities: [{data: {title: "a"}, deleted: false, id: "t1", seq: 5}],
        frontierSeq: 5,
        hasMore: false,
      }),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    // page.cursor 9 is clamped down to the frontier 5.
    expect(getCursor({store, stream: STREAM})).toBe(5);
  });

  it("C3: drains the legacy stratum by echoing legacyCursor, then proceeds by seq", async () => {
    const store = makeStore();
    const channel = makeChannel({
      // Echo legacyCursor L2 → second legacy page.
      "legacy:L2": page({
        cursor: 0,
        entities: [{data: {title: "l3"}, deleted: false, id: "L3", seq: 0}],
        hasMore: true,
        legacyCursor: "L3",
      }),
      // Echo legacyCursor L3 → legacy exhausted (no legacyCursor); switch to seq paging.
      "legacy:L3": page({
        cursor: 3,
        entities: [{data: {title: "s1"}, deleted: false, id: "S1", seq: 3}],
        frontierSeq: 3,
        hasMore: false,
      }),
      // First request (cursor 0, no legacyCursor) → first legacy page.
      "legacy:start": page({
        cursor: 0,
        entities: [
          {data: {title: "l1"}, deleted: false, id: "L1", seq: 0},
          {data: {title: "l2"}, deleted: false, id: "L2", seq: 0},
        ],
        hasMore: true,
        legacyCursor: "L2",
      }),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});

    // All legacy entities applied.
    expect(store.getEntity({collection: "todos", id: "L1"})?.data).toEqual({title: "l1"});
    expect(store.getEntity({collection: "todos", id: "L3"})?.data).toEqual({title: "l3"});
    // Then the seq-stratum entity.
    expect(store.getEntity({collection: "todos", id: "S1"})?.seq).toBe(3);
    expect(getCursor({store, stream: STREAM})).toBe(3);
    // legacyCursor echoed forward: undefined → L2 → L3, then the final seq page.
    expect(channel.calls.map((c) => c.legacyCursor)).toEqual([undefined, "L2", "L3"]);
  });

  it("C3: terminates on a large legacy stratum spanning many pages (loop-guard intact)", async () => {
    const store = makeStore();
    // 1201 legacy entities, 500 per page → 3 legacy pages then a terminating seq page.
    const total = 1201;
    const limit = 500;
    const byKey: Record<string, SyncSnapshotResponse> = {};
    let done = 0;
    let prevKey = "legacy:start";
    while (done < total) {
      const size = Math.min(limit, total - done);
      const entities = Array.from({length: size}, (_, i) => ({
        data: {n: done + i},
        deleted: false,
        id: `L${done + i}`,
        seq: 0,
      }));
      const lastId = `L${done + size - 1}`;
      byKey[prevKey] = page({cursor: 0, entities, hasMore: true, legacyCursor: lastId});
      prevKey = `legacy:${lastId}`;
      done += size;
      if (done >= total) {
        // The request echoing the final legacy id drains into the (empty) seq stratum.
        byKey[prevKey] = page({cursor: 0, entities: [], frontierSeq: 0, hasMore: false});
      }
    }
    const channel = makeChannel(byKey);
    await bootstrapStream({channel, collection: "todos", limit, store, stream: STREAM});

    expect(store.listEntities({collection: "todos"}).length).toBe(total);
    expect(store.getEntity({collection: "todos", id: "L0"})).toBeDefined();
    expect(store.getEntity({collection: "todos", id: `L${total - 1}`})).toBeDefined();
    // 3 legacy pages + 1 terminating seq page.
    expect(channel.calls.length).toBe(4);
  });

  it("C7: re-bootstraps from 0 when the stored cursor is below oldestRetainedSeq", async () => {
    const store = makeStore();
    // Client is at cursor 5 with a stale entity written under this stream.
    setCursor({seq: 5, store, stream: STREAM});
    store.upsertEntity({
      collection: "todos",
      data: {title: "stale"},
      id: "old",
      seq: 5,
      stream: STREAM,
    });
    store.addKnownStream({collection: "todos", stream: STREAM});
    const channel = makeChannel({
      // After purge, re-bootstrap from 0.
      0: page({
        cursor: 12,
        entities: [{data: {title: "fresh"}, deleted: false, id: "new", seq: 12}],
        frontierSeq: 20,
        hasMore: false,
        oldestRetainedSeq: 10,
      }),
      // First fetch at cursor 5 reports the retained floor is 10 → retention gap.
      5: page({cursor: 5, entities: [], frontierSeq: 20, oldestRetainedSeq: 10}),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});

    // Stale entity purged, fresh entity present.
    expect(store.getEntity({collection: "todos", id: "old"})).toBeUndefined();
    expect(store.getEntity({collection: "todos", id: "new"})?.data).toEqual({title: "fresh"});
    // The stream remains known after re-bootstrap.
    expect(store.getKnownStreams()).toContain(STREAM);
    expect(getCursor({store, stream: STREAM})).toBe(12);
    // First call at cursor 5, then re-bootstrap at cursor 0.
    expect(channel.calls.map((c) => c.cursor)).toEqual([5, 0]);
  });

  it("C7: no re-bootstrap when the cursor is at or above the retained floor", async () => {
    const store = makeStore();
    setCursor({seq: 10, store, stream: STREAM});
    store.upsertEntity({
      collection: "todos",
      data: {title: "kept"},
      id: "keep",
      seq: 10,
      stream: STREAM,
    });
    const channel = makeChannel({
      10: page({cursor: 10, entities: [], frontierSeq: 10, oldestRetainedSeq: 10}),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    expect(store.getEntity({collection: "todos", id: "keep"})).toBeDefined();
    expect(channel.calls.map((c) => c.cursor)).toEqual([10]);
  });

  it("never overwrites an entity protected by a pending outbox mutation", async () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "local edit"},
      id: "t1",
      pendingMutationId: "m1",
      seq: 1,
    });
    const channel = makeChannel({
      0: page({
        cursor: 5,
        entities: [{data: {title: "server"}, deleted: false, id: "t1", seq: 5}],
        frontierSeq: 5,
        hasMore: false,
      }),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "local edit"});
    expect(entity?.pendingMutationId).toBe("m1");
    // The cursor still advances so the protected entity is not refetched forever.
    expect(getCursor({store, stream: STREAM})).toBe(5);
  });

  it("skips entities at or below the locally applied seq", async () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "newer"}, id: "t1", seq: 8});
    const channel = makeChannel({
      0: page({
        cursor: 8,
        entities: [{data: {title: "stale"}, deleted: false, id: "t1", seq: 8}],
        frontierSeq: 8,
        hasMore: false,
      }),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "newer"});
  });

  it("stops when hasMore is set but the cursor did not advance (server bug guard)", async () => {
    const store = makeStore();
    const channel = makeChannel({
      0: page({cursor: 0, entities: [], frontierSeq: 0, hasMore: true}),
    });
    await bootstrapStream({channel, collection: "todos", store, stream: STREAM});
    expect(channel.calls).toHaveLength(1);
  });

  it("reports progress per page and forwards the limit", async () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "mine"},
      id: "t2",
      pendingMutationId: "m9",
    });
    const channel = makeChannel({
      0: page({
        cursor: 2,
        entities: [
          {data: {title: "a"}, deleted: false, id: "t1", seq: 1},
          {data: {title: "b"}, deleted: false, id: "t2", seq: 2},
        ],
        frontierSeq: 2,
        hasMore: false,
      }),
    });
    const progress: BootstrapProgress[] = [];
    await bootstrapStream({
      channel,
      collection: "todos",
      limit: 25,
      onProgress: (update: BootstrapProgress) => progress.push(update),
      store,
      stream: STREAM,
    });
    expect(channel.calls[0]?.limit).toBe(25);
    expect(progress).toEqual([
      {applied: 1, collection: "todos", cursor: 2, fetched: 2, hasMore: false, stream: STREAM},
    ]);
  });
});
