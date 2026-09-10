import {describe, it} from "bun:test";
import {assert} from "chai";

import {createSyncStore} from "../storage/store";
import type {SyncSubscribeMode} from "../types";
import {adminWindowStream, hydrateWindowEntities} from "./windowHydrate";

const STREAM = adminWindowStream("todos");
const WINDOW_MODE: SyncSubscribeMode = "window";

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
    assert.equal(WINDOW_MODE, "window");
  });

  it("upserts REST rows immediately and only fetches ids still missing", async () => {
    const store = createSyncStore({collections: ["todos"]});
    const fetched: string[][] = [];
    await hydrateWindowEntities({
      channel: {
        fetchEntities: async ({ids}) => {
          fetched.push(ids);
          return {
            entities: [{data: {title: "from-entities"}, deleted: false, id: "b", seq: 9}],
          };
        },
      },
      collection: "todos",
      ids: ["a", "b"],
      restRows: {a: {title: "from-rest"}},
      store,
    });

    assert.deepEqual(fetched, [["b"]]);
    const restRow = store.getEntity<{title: string}>({collection: "todos", id: "a"});
    const entityRow = store.getEntity<{title: string}>({collection: "todos", id: "b"});
    assert.equal(restRow?.data.title, "from-rest");
    assert.equal(entityRow?.data.title, "from-entities");
    assert.equal(entityRow?.seq, 9);
  });
});
