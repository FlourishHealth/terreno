// noExplicitAny: test model typing
// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeEach, describe, expect, it} from "bun:test";
import {assert} from "chai";
import express from "express";
import {model, Schema} from "mongoose";
import type {ModelRouterOptions} from "../api";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {setupDb} from "../tests";
import {SyncCounter, SyncKey, SyncMutation, SyncScopeMove} from "./models";
import {clearSyncRegistry, ensureSyncIndexes, registerSync} from "./registry";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";

/**
 * C8: `ensureSyncIndexes()` must fail server startup loudly when a snapshot-index
 * createIndex rejects (a missing index table-scans the snapshot/catch-up query under
 * load), and resolve quietly otherwise. Wired into TerrenoApp.start() before listen.
 *
 * Task 9.9: registering `SyncApp` also enqueues the bookkeeping-model indexes
 * (`SyncCounter.stream` / `SyncMutation.mutationId` uniques, the scope-move lookups,
 * `SyncKey.userId`), so they exist after startup without any manual `ensureIndexes()`
 * call — without the unique indexes, duplicate mutation deliveries double-apply and the
 * counter upsert race mints duplicate seqs. Index work must remain deferred until this
 * function runs because model registration can happen before MongoDB connects.
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

  it("defers snapshot index creation until startup ensures indexes", async () => {
    const IndexTodoModel = buildModel("EnsureIndexTodoDeferred");
    let createIndexCalls = 0;
    (IndexTodoModel.collection as any).createIndex = async () => {
      createIndexCalls += 1;
      return "ownerId_1__syncSeq_1";
    };

    registerSync({
      config: {scope: {type: "owner"}},
      model: IndexTodoModel as any,
      options: authedOptions,
      routePath: "/ensureIndexTodosDeferred",
    });

    assert.strictEqual(createIndexCalls, 0);
    await ensureSyncIndexes();
    assert.strictEqual(createIndexCalls, 1);
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

describe("sync bookkeeping indexes at startup (Task 9.9)", () => {
  /** Index key patterns each bookkeeping model must have after startup. */
  const requiredIndexes = [
    {isUnique: true, keys: {stream: 1}, model: SyncCounter},
    {isUnique: true, keys: {mutationId: 1}, model: SyncMutation},
    {isUnique: false, keys: {fromStream: 1, seq: 1}, model: SyncScopeMove},
    {isUnique: false, keys: {collectionTag: 1, entityId: 1}, model: SyncScopeMove},
    {isUnique: true, keys: {userId: 1}, model: SyncKey},
  ];

  beforeEach(async () => {
    await setupDb();
    clearSyncRegistry();
  });

  it("creates every bookkeeping index after SyncApp.register + ensureSyncIndexes", async () => {
    // Start from a state with no bookkeeping indexes at all (as in a fresh deploy with
    // autoIndex disabled), so only the startup wiring can put them back.
    for (const {model: bookkeepingModel} of requiredIndexes) {
      await bookkeepingModel.collection.dropIndexes().catch(() => {});
    }

    new SyncApp().register(express());
    await ensureSyncIndexes();

    for (const {isUnique, keys, model: bookkeepingModel} of requiredIndexes) {
      const indexes = (await bookkeepingModel.collection.indexes()) as {
        key: Record<string, number>;
        unique?: boolean;
      }[];
      const match = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(keys));
      const label = `${bookkeepingModel.modelName} ${JSON.stringify(keys)}`;
      expect(match ? label : `missing index: ${label}`).toBe(label);
      expect(Boolean(match?.unique)).toBe(isUnique);
    }
  });

  it("rejects with an actionable error when a bookkeeping index build fails", async () => {
    const originalEnsure = SyncMutation.ensureIndexes.bind(SyncMutation);
    (SyncMutation as any).ensureIndexes = async () => {
      throw new Error("boom: mutationId index build failed");
    };
    try {
      new SyncApp().register(express());
      await expect(ensureSyncIndexes()).rejects.toThrow(
        /Failed to ensure sync indexes for SyncMutation/
      );
    } finally {
      (SyncMutation as any).ensureIndexes = originalEnsure;
    }
  });
});
