import {describe, it} from "bun:test";
import {assert} from "chai";
import {DateTime} from "luxon";

import {createSyncStore} from "../storage/store";
import {hydrateWindowEntities} from "./windowHydrate";

const STREAM = "todos|admin";

describe("hydrateWindowEntities", () => {
  it("hydrates 2 of 3 ids and ignores the unknown id", async () => {
    const store = createSyncStore({collections: ["todos"]});
    const requested: string[] = [];
    const result = await hydrateWindowEntities({
      channel: {
        fetchEntities: async ({ids}) => {
          requested.push(...ids);
          return {
            entities: [
              {data: {title: "one"}, deleted: false, id: "a", seq: 4},
              {data: {title: "two"}, deleted: false, id: "b", seq: 5},
            ],
          };
        },
      },
      collection: "todos",
      ids: ["a", "b", "missing"],
      store,
    });

    assert.deepEqual(requested, ["a", "b", "missing"]);
    assert.deepEqual(result.hydratedIds.sort(), ["a", "b"]);
    const rowA = store.getEntity<{title: string}>({collection: "todos", id: "a"});
    const rowB = store.getEntity<{title: string}>({collection: "todos", id: "b"});
    assert.equal(rowA?.data.title, "one");
    assert.equal(rowB?.seq, 5);
    assert.isUndefined(store.getEntity({collection: "todos", id: "missing"}));
    assert.equal(rowA?.stream, STREAM);
  });

  it("upserts REST rows immediately and fetches every id for seq/deleted metadata", async () => {
    const store = createSyncStore({collections: ["todos"]});
    const fetched: string[][] = [];
    await hydrateWindowEntities({
      channel: {
        fetchEntities: async ({ids}) => {
          fetched.push(ids);
          return {
            entities: [
              {data: {title: "canonical-a"}, deleted: false, id: "a", seq: 7},
              {data: {title: "from-entities"}, deleted: false, id: "b", seq: 9},
            ],
          };
        },
      },
      collection: "todos",
      ids: ["a", "b"],
      restRows: {a: {title: "from-rest"}},
      store,
    });

    assert.deepEqual(fetched, [["a", "b"]]);
    const restRow = store.getEntity<{title: string}>({collection: "todos", id: "a"});
    const entityRow = store.getEntity<{title: string}>({collection: "todos", id: "b"});
    assert.equal(restRow?.data.title, "from-rest");
    assert.equal(restRow?.seq, 7);
    assert.equal(entityRow?.data.title, "from-entities");
    assert.equal(entityRow?.seq, 9);
  });

  it("exposes REST row data before entities fetch resolves", async () => {
    const store = createSyncStore({collections: ["todos"]});
    const updatedAt = DateTime.utc().toISO();
    let restRowDuringFetch: {data?: {title?: string; updated?: string}; seq?: number} | undefined;

    await hydrateWindowEntities({
      channel: {
        fetchEntities: async () => {
          restRowDuringFetch = store.getEntity<{title: string; updated?: string}>({
            collection: "todos",
            id: "a",
          });
          return {
            entities: [{data: {title: "canonical"}, deleted: false, id: "a", seq: 11}],
          };
        },
      },
      collection: "todos",
      ids: ["a"],
      restRows: {a: {title: "from-rest", updated: updatedAt}},
      store,
    });

    assert.equal(restRowDuringFetch?.data?.title, "from-rest");
    assert.equal(restRowDuringFetch?.data?.updated, updatedAt);
    assert.equal(restRowDuringFetch?.seq, 0);
    const row = store.getEntity<{title: string; updated?: string}>({collection: "todos", id: "a"});
    assert.equal(row?.seq, 11);
  });

  it("applies deleted metadata from entities onto REST rows", async () => {
    const store = createSyncStore({collections: ["todos"]});
    await hydrateWindowEntities({
      channel: {
        fetchEntities: async () => ({
          entities: [{data: {title: "gone"}, deleted: true, id: "a", seq: 12}],
        }),
      },
      collection: "todos",
      ids: ["a"],
      restRows: {a: {title: "from-rest"}},
      store,
    });

    const row = store.getEntity<{title: string}>({collection: "todos", id: "a"});
    assert.equal(row?.data.title, "from-rest");
    assert.equal(row?.seq, 12);
    assert.isTrue(row?.deleted);
  });

  it("skips REST and entities upserts when a pending optimistic mutation owns the row", async () => {
    const store = createSyncStore({collections: ["todos"]});
    store.upsertEntity({
      collection: "todos",
      data: {title: "pending-local"},
      id: "a",
      pendingMutationId: "m-pending",
      seq: 3,
      stream: STREAM,
    });

    await hydrateWindowEntities({
      channel: {
        fetchEntities: async () => ({
          entities: [{data: {title: "server"}, deleted: false, id: "a", seq: 99}],
        }),
      },
      collection: "todos",
      ids: ["a"],
      restRows: {a: {title: "from-rest"}},
      store,
    });

    const row = store.getEntity<{title: string}>({collection: "todos", id: "a"});
    assert.equal(row?.data.title, "pending-local");
    assert.equal(row?.seq, 3);
    assert.equal(row?.pendingMutationId, "m-pending");
  });
});
