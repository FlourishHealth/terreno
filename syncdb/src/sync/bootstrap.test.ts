import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import type {SyncSnapshotResponse} from "../types";
import {type BootstrapProgress, bootstrapCollections, snapshotCursorStream} from "./bootstrap";
import {getCursor, setCursor} from "./cursor";
import type {FetchSnapshotPageArgs} from "./httpChannel";

const makeStore = (): SyncStore => createSyncStore({collections: ["notes", "todos"]});

/** Channel stub serving canned pages per collection, keyed by request cursor. */
const makeChannel = (
  pages: Record<string, Record<number, SyncSnapshotResponse>>
): {
  fetchSnapshotPage: (args: FetchSnapshotPageArgs) => Promise<SyncSnapshotResponse>;
  calls: FetchSnapshotPageArgs[];
} => {
  const calls: FetchSnapshotPageArgs[] = [];
  return {
    calls,
    fetchSnapshotPage: async (args: FetchSnapshotPageArgs): Promise<SyncSnapshotResponse> => {
      calls.push(args);
      const page = pages[args.collection]?.[args.cursor];
      if (!page) {
        throw new Error(`No canned page for ${args.collection}@${args.cursor}`);
      }
      return page;
    },
  };
};

describe("bootstrapCollections", () => {
  it("pages a collection to completion and advances the snapshot cursor", async () => {
    const store = makeStore();
    const channel = makeChannel({
      todos: {
        0: {
          cursor: 2,
          entities: [
            {data: {title: "a"}, deleted: false, id: "t1", seq: 1},
            {data: {title: "b"}, deleted: false, id: "t2", seq: 2},
          ],
          hasMore: true,
        },
        2: {
          cursor: 3,
          entities: [{data: {title: "c"}, deleted: true, id: "t3", seq: 3}],
          hasMore: false,
        },
      },
    });
    await bootstrapCollections({channel, collections: ["todos"], store});

    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "a"});
    expect(store.getEntity({collection: "todos", id: "t2"})?.seq).toBe(2);
    expect(store.getEntity({collection: "todos", id: "t3"})?.deleted).toBe(true);
    expect(getCursor({store, stream: snapshotCursorStream("todos")})).toBe(3);
    expect(channel.calls.map((call) => call.cursor)).toEqual([0, 2]);
  });

  it("resumes from the persisted per-collection cursor", async () => {
    const store = makeStore();
    setCursor({seq: 10, store, stream: snapshotCursorStream("todos")});
    const channel = makeChannel({
      todos: {10: {cursor: 10, entities: [], hasMore: false}},
    });
    await bootstrapCollections({channel, collections: ["todos"], store});
    expect(channel.calls).toEqual([{collection: "todos", cursor: 10, limit: undefined}]);
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
      todos: {
        0: {
          cursor: 5,
          entities: [{data: {title: "server"}, deleted: false, id: "t1", seq: 5}],
          hasMore: false,
        },
      },
    });
    await bootstrapCollections({channel, collections: ["todos"], store});
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "local edit"});
    expect(entity?.pendingMutationId).toBe("m1");
    // The cursor still advances so the protected entity is not refetched forever.
    expect(getCursor({store, stream: snapshotCursorStream("todos")})).toBe(5);
  });

  it("skips entities at or below the locally applied seq", async () => {
    const store = makeStore();
    store.upsertEntity({collection: "todos", data: {title: "newer"}, id: "t1", seq: 8});
    const channel = makeChannel({
      todos: {
        0: {
          cursor: 8,
          entities: [{data: {title: "stale"}, deleted: false, id: "t1", seq: 8}],
          hasMore: false,
        },
      },
    });
    await bootstrapCollections({channel, collections: ["todos"], store});
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "newer"});
  });

  it("bootstraps each collection with an independent cursor", async () => {
    const store = makeStore();
    const channel = makeChannel({
      notes: {
        0: {
          cursor: 1,
          entities: [{data: {body: "n"}, deleted: false, id: "n1", seq: 1}],
          hasMore: false,
        },
      },
      todos: {
        0: {
          cursor: 4,
          entities: [{data: {title: "t"}, deleted: false, id: "t1", seq: 4}],
          hasMore: false,
        },
      },
    });
    await bootstrapCollections({channel, collections: ["todos", "notes"], store});
    expect(getCursor({store, stream: snapshotCursorStream("todos")})).toBe(4);
    expect(getCursor({store, stream: snapshotCursorStream("notes")})).toBe(1);
  });

  it("stops when hasMore is set but the cursor did not advance (server bug guard)", async () => {
    const store = makeStore();
    const channel = makeChannel({
      todos: {0: {cursor: 0, entities: [], hasMore: true}},
    });
    await bootstrapCollections({channel, collections: ["todos"], store});
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
      todos: {
        0: {
          cursor: 2,
          entities: [
            {data: {title: "a"}, deleted: false, id: "t1", seq: 1},
            {data: {title: "b"}, deleted: false, id: "t2", seq: 2},
          ],
          hasMore: false,
        },
      },
    });
    const progress: BootstrapProgress[] = [];
    await bootstrapCollections({
      channel,
      collections: ["todos"],
      limit: 25,
      onProgress: (update) => progress.push(update),
      store,
    });
    expect(channel.calls[0]?.limit).toBe(25);
    expect(progress).toEqual([
      {applied: 1, collection: "todos", cursor: 2, fetched: 2, hasMore: false},
    ]);
  });

  it("applies a whole page inside one transaction: exactly one table-listener fire per page (E4)", async () => {
    const store = makeStore();
    const channel = makeChannel({
      todos: {
        0: {
          cursor: 3,
          entities: [
            {data: {title: "a"}, deleted: false, id: "t1", seq: 1},
            {data: {title: "b"}, deleted: false, id: "t2", seq: 2},
            {data: {title: "c"}, deleted: false, id: "t3", seq: 3},
          ],
          hasMore: true,
        },
        3: {
          cursor: 5,
          entities: [
            {data: {title: "d"}, deleted: false, id: "t4", seq: 4},
            {data: {title: "e"}, deleted: false, id: "t5", seq: 5},
          ],
          hasMore: false,
        },
      },
    });
    let fireCount = 0;
    const listenerId = store.raw.addTableListener("todos", () => {
      fireCount += 1;
    });
    await bootstrapCollections({channel, collections: ["todos"], store});
    store.raw.delListener(listenerId);
    // Two pages fetched (hasMore then a final page) — one listener fire per
    // page, not per row (5 entities total across both pages would mean 5
    // fires if each upsert were its own transaction).
    expect(fireCount).toBe(2);
    expect(store.listEntities({collection: "todos"})).toHaveLength(5);
  });
});
