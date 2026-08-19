// noExplicitAny: mongoose model/query generics in test doubles
// biome-ignore-all lint/suspicious/noExplicitAny: mongoose model/query generics in test doubles
import {afterEach, beforeAll, beforeEach, describe, expect, it, type Mock, spyOn} from "bun:test";
import {model, Schema, type Types} from "mongoose";
import type {ModelRouterOptions} from "../api";
import {logger} from "../logger";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {setupDb} from "../tests";
import {SyncCounter, SyncScopeMove} from "./models";
import {clearSyncRegistry, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";
import type {SyncConfig} from "./types";

interface PluginStuff extends IsDeleted {
  _id: Types.ObjectId;
  name: string;
  ownerId?: string;
  orgId?: string;
  _syncSeq?: number;
  _syncPrevStream?: string | null;
}

const buildSchema = (): Schema<PluginStuff> => {
  const schema = new Schema<PluginStuff>({
    name: {description: "The name of the item", type: String},
    orgId: {description: "The organization this item belongs to", type: String},
    ownerId: {description: "The user who owns this item", type: String},
  });
  schema.plugin(isDeletedPlugin);
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(syncPlugin);
  return schema;
};

const StuffModel = model<PluginStuff>("SyncSeqPluginStuff", buildSchema());
const UnregisteredModel = model<PluginStuff>("SyncSeqPluginUnregistered", buildSchema());

const stubOptions = {
  permissions: {create: [], delete: [], list: [], read: [], update: []},
} as unknown as ModelRouterOptions<any>;

const register = (config: SyncConfig = {scope: {type: "owner"}}): void => {
  registerSync({config, model: StuffModel as any, options: stubOptions, routePath: "/pluginStuff"});
};

/** Every SyncCounter.updateOne is a confirm/release $pull; resolving 0 fakes a reaped lease. */
const fakeReapedConfirms = () =>
  spyOn(SyncCounter, "updateOne").mockImplementation((() =>
    Promise.resolve({modifiedCount: 0})) as any);

const failConfirms = () =>
  spyOn(SyncCounter, "updateOne").mockImplementation((() =>
    Promise.reject(new Error("confirm exploded"))) as any);

const errorMessages = (errorSpy: Mock<typeof logger.error>): string[] =>
  errorSpy.mock.calls.map((call) => String(call[0]));

describe("syncPlugin schema contract", () => {
  it("throws when the schema disables the version key", () => {
    const schema = new Schema({name: {description: "Name", type: String}}, {versionKey: false});
    expect(() => schema.plugin(syncPlugin)).toThrow(/versionKey/);
  });
});

describe("syncPlugin on an unregistered model", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    await UnregisteredModel.deleteMany({});
  });

  it("stamps nothing on save, hydration, insertMany, or query writes", async () => {
    const created = await UnregisteredModel.create({name: "one", ownerId: "u1"});
    // Hydration runs the post("init") hook, which must not record an initial stream.
    const loaded = await UnregisteredModel.findById(created._id);
    expect(loaded?._syncSeq).toBeUndefined();

    await UnregisteredModel.insertMany([{name: "two", ownerId: "u1"}]);
    await UnregisteredModel.updateOne({name: "one"}, {$set: {name: "renamed"}});

    const docs = await UnregisteredModel.find({});
    expect(docs).toHaveLength(2);
    expect(docs.every((doc) => doc._syncSeq === undefined)).toBe(true);
  });
});

describe("syncPlugin insertMany edge cases", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    register();
    await StuffModel.collection.deleteMany({});
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("no-ops for an empty batch", async () => {
    const inserted = await StuffModel.insertMany([]);
    expect(inserted).toHaveLength(0);
  });

  it("logs but does not fail the batch when the confirm errors", async () => {
    const errorSpy = spyOn(logger, "error");
    const updateSpy = failConfirms();

    try {
      const inserted = await StuffModel.insertMany([
        {name: "a", ownerId: "u1"},
        {name: "b", ownerId: "u1"},
      ]);
      expect(inserted).toHaveLength(2);
      expect(errorMessages(errorSpy)).toContain("[sync] Failed to confirm insertMany seqs");
    } finally {
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("syncPlugin query-write filters", () => {
  let existing: PluginStuff;

  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    register();
    await StuffModel.collection.deleteMany({});
    existing = await StuffModel.create({name: "target", ownerId: "u1"});
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("accepts an ObjectId filter", async () => {
    await StuffModel.updateOne({_id: existing._id}, {$set: {name: "renamed"}});

    const updated = await StuffModel.findById(existing._id);
    expect(updated?.name).toBe("renamed");
    expect(updated?._syncSeq).toBeGreaterThan(existing._syncSeq ?? 0);
  });

  it("accepts an $eq filter on _id", async () => {
    await StuffModel.updateOne({_id: {$eq: existing._id}}, {$set: {name: "eq"}});

    expect((await StuffModel.findById(existing._id))?.name).toBe("eq");
  });

  it("rejects a multi-document _id operator", async () => {
    await expect(
      StuffModel.updateOne({_id: {$in: [existing._id]}}, {$set: {name: "nope"}}).exec()
    ).rejects.toThrow(/must target a single document by _id/);
  });

  it("logs but does not fail the write when the confirm errors", async () => {
    const errorSpy = spyOn(logger, "error");
    const updateSpy = failConfirms();

    try {
      await StuffModel.findByIdAndUpdate(existing._id, {$set: {name: "confirm-fails"}});
      expect(errorMessages(errorSpy)).toContain("[sync] Failed to confirm seq after query write");
    } finally {
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("syncPlugin query-write stream resolution", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    await StuffModel.collection.deleteMany({});
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("keeps the document's stream for a broadcast scope", async () => {
    register({scope: {type: "broadcast"}});
    const created = await StuffModel.create({name: "broadcast", ownerId: "u1"});

    await StuffModel.updateOne({_id: created._id}, {$set: {ownerId: "u2"}});

    const updated = await StuffModel.findById(created._id);
    expect(updated?._syncPrevStream).toBeNull();
    expect(updated?._syncSeq).toBeGreaterThan(created._syncSeq ?? 0);
  });

  it("resolves a custom resolver scope from the merged update", async () => {
    register({
      scope: (doc) => String((doc as {orgId?: string}).orgId ?? "none"),
      snapshotFilter: () => ({}),
    });
    const created = await StuffModel.create({name: "custom", orgId: "org1"});

    await StuffModel.updateOne({_id: created._id}, {$set: {orgId: "org2"}});

    const updated = await StuffModel.findById(created._id);
    expect(updated?._syncPrevStream).toBe("pluginStuff|custom:org1");
    expect(updated?._syncSeq).toBe(1);
  });
});

describe("syncPlugin scope-move markers", () => {
  const tenantConfig: SyncConfig = {scope: {field: "orgId", type: "tenant"}};

  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    register(tenantConfig);
    await Promise.all([StuffModel.collection.deleteMany({}), SyncScopeMove.deleteMany({})]);
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("logs and skips the marker when the old stream's seq claim fails", async () => {
    const created = await StuffModel.create({name: "moving", orgId: "org1"});
    const oldStream = "pluginStuff|tenant:org1";
    const errorSpy = spyOn(logger, "error");
    const claimStream = SyncCounter.findOneAndUpdate.bind(SyncCounter);
    const claimSpy = spyOn(SyncCounter, "findOneAndUpdate").mockImplementation(((
      filter: {stream?: string},
      ...rest: unknown[]
    ) =>
      filter?.stream === oldStream
        ? Promise.reject(new Error("claim exploded"))
        : (claimStream as (...args: unknown[]) => unknown)(filter, ...rest)) as any);

    try {
      await StuffModel.updateOne({_id: created._id}, {$set: {orgId: "org2"}});

      expect(errorMessages(errorSpy)).toContain("[sync] Failed to claim scope-move marker seq");
      expect(await SyncScopeMove.countDocuments({entityId: String(created._id)})).toBe(0);
    } finally {
      claimSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("writes the marker and logs when confirming its seq fails", async () => {
    const created = await StuffModel.create({name: "moving", orgId: "org1"});
    const errorSpy = spyOn(logger, "error");
    const updateSpy = failConfirms();

    try {
      await StuffModel.updateOne({_id: created._id}, {$set: {orgId: "org2"}});

      const marker = await SyncScopeMove.findOne({entityId: String(created._id)});
      expect(marker?.fromStream).toBe("pluginStuff|tenant:org1");
      expect(marker?.toStream).toBe("pluginStuff|tenant:org2");
      expect(errorMessages(errorSpy)).toContain("[sync] Failed to confirm scope-move marker seq");
    } finally {
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});

describe("syncPlugin save confirmation failures", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    register();
    await StuffModel.collection.deleteMany({});
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("logs a confirm error without failing the save", async () => {
    const errorSpy = spyOn(logger, "error");
    const updateSpy = failConfirms();

    try {
      const created = await StuffModel.create({name: "confirm-error", ownerId: "u1"});
      expect(created._syncSeq).toBeGreaterThan(0);
      expect(errorMessages(errorSpy)).toContain("[sync] Failed to confirm seq after save");
    } finally {
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("re-stamps the document when its claim was reaped before the write committed", async () => {
    const created = await StuffModel.create({name: "reaped", ownerId: "u1"});
    const errorSpy = spyOn(logger, "error");
    const updateSpy = fakeReapedConfirms();

    try {
      created.name = "reaped-again";
      await created.save();

      expect(created._syncSeq).toBeGreaterThan(1);
      const messages = errorMessages(errorSpy);
      expect(messages).toContain(
        "[sync] Seq claim was reaped before its write committed; re-stamping the document above " +
          "the frontier"
      );
      expect(messages).toContain(
        "[sync] Re-stamped seq was itself reaped; document remains below the frontier"
      );
      const stored = await StuffModel.findById(created._id);
      expect(stored?._syncSeq).toBe(created._syncSeq);
    } finally {
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("releases the re-stamp claim when the re-stamp matches no document", async () => {
    const created = await StuffModel.create({name: "vanished", ownerId: "u1"});
    const errorSpy = spyOn(logger, "error");
    const updateSpy = fakeReapedConfirms();
    // The save's own write is the first collection update; the re-stamp is the second.
    const collectionUpdate = StuffModel.collection.updateOne.bind(StuffModel.collection);
    let collectionUpdates = 0;
    const collectionSpy = spyOn(StuffModel.collection, "updateOne").mockImplementation(((
      ...args: unknown[]
    ) => {
      collectionUpdates += 1;
      return collectionUpdates > 1
        ? Promise.resolve({matchedCount: 0})
        : (collectionUpdate as (...args: unknown[]) => unknown)(...args);
    }) as any);

    try {
      created.name = "vanished-again";
      await created.save();

      expect(errorMessages(errorSpy)).toContain(
        "[sync] Re-stamp matched no document; releasing the re-stamp claim"
      );
    } finally {
      collectionSpy.mockRestore();
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("logs when the re-stamp itself fails", async () => {
    const created = await StuffModel.create({name: "restamp-fails", ownerId: "u1"});
    const errorSpy = spyOn(logger, "error");
    const updateSpy = fakeReapedConfirms();
    const claimStream = SyncCounter.findOneAndUpdate.bind(SyncCounter) as (
      ...args: unknown[]
    ) => unknown;
    let claims = 0;
    const claimSpy = spyOn(SyncCounter, "findOneAndUpdate").mockImplementation(((
      ...args: unknown[]
    ) => {
      claims += 1;
      // The first claim belongs to the save itself; the second is the re-stamp.
      return claims > 1 ? Promise.reject(new Error("claim exploded")) : claimStream(...args);
    }) as any);

    try {
      created.name = "restamp-fails-again";
      await created.save();

      expect(errorMessages(errorSpy)).toContain("[sync] Failed to re-stamp a reaped seq");
    } finally {
      claimSpy.mockRestore();
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("logs when releasing the claim of a failed save fails", async () => {
    const created = await StuffModel.create({name: "stale", ownerId: "u1"});
    const stale = await StuffModel.findById(created._id);
    if (!stale) {
      throw new Error("expected the document to load");
    }
    // Bump __v so the stale instance's optimistic-concurrency save loses.
    created.name = "fresh";
    await created.save();

    const errorSpy = spyOn(logger, "error");
    const updateSpy = failConfirms();

    try {
      stale.name = "loser";
      await expect(stale.save()).rejects.toThrow();

      expect(errorMessages(errorSpy)).toContain(
        "[sync] Failed to release seq claim after failed save"
      );
    } finally {
      updateSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
