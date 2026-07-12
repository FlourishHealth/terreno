// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeEach, describe, expect, it} from "bun:test";
import {model, Schema} from "mongoose";
import type {ModelRouterOptions} from "../api";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {clearSyncRegistry, ensureSyncIndexes, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";

/**
 * C8: `ensureSyncIndexes()` must fail server startup loudly when a snapshot-index
 * createIndex rejects (a missing index table-scans the snapshot/catch-up query under
 * load), and resolve quietly otherwise. Wired into TerrenoApp.start() before listen.
 */

interface IndexTodo extends IsDeleted {
  _id: string;
  title: string;
  ownerId: string;
  _syncSeq?: number;
}

const buildModel = (name: string) => {
  const schema = new Schema<IndexTodo>({
    ownerId: {description: "The owner", type: String},
    title: {description: "The title", required: true, type: String},
  });
  schema.plugin(isDeletedPlugin);
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(syncPlugin);
  return model<IndexTodo>(name, schema);
};

const authedOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
} as unknown as ModelRouterOptions<any>;

describe("ensureSyncIndexes (C8)", () => {
  beforeEach(() => {
    clearSyncRegistry();
  });

  it("resolves when there are no registered sync models", async () => {
    await expect(ensureSyncIndexes()).resolves.toBeUndefined();
  });

  it("resolves once a registered model's snapshot index is created", async () => {
    const IndexTodoModel = buildModel("EnsureIndexTodoOk");
    registerSync({
      config: {scope: {type: "owner"}},
      model: IndexTodoModel as any,
      options: authedOptions,
      routePath: "/ensureIndexTodosOk",
    });
    await expect(ensureSyncIndexes()).resolves.toBeUndefined();
  });

  it("rejects with an actionable error when createIndex fails, so startup fails loudly", async () => {
    const IndexTodoModel = buildModel("EnsureIndexTodoFail");
    // Force the collection's createIndex to reject, simulating a DB/schema failure.
    (IndexTodoModel.collection as any).createIndex = async () => {
      throw new Error("boom: index build failed");
    };
    registerSync({
      config: {scope: {type: "owner"}},
      model: IndexTodoModel as any,
      options: authedOptions,
      routePath: "/ensureIndexTodosFail",
    });
    await expect(ensureSyncIndexes()).rejects.toThrow(
      /Failed to create sync snapshot index for EnsureIndexTodoFail/
    );
  });
});
