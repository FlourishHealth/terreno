// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeAll, beforeEach, describe, expect, it} from "bun:test";
import {model, Schema} from "mongoose";
import {type ModelRouterOptions, modelRouter} from "../api";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {setupDb} from "../tests";
import {claimSyncSeqs, getOrCreateSyncKeyMaterial, SyncCounter, SyncKey} from "./models";
import {
  clearSyncRegistry,
  findSyncEntryByCollectionTag,
  findSyncEntryByModelName,
  getSyncRegistry,
  registerSync,
} from "./registry";
import {getScopeField, resolveStreamForDoc, streamForScopeValue} from "./streams";
import {syncPlugin} from "./syncSeqPlugin";
import type {SyncConfig} from "./types";

interface SyncStuff extends IsDeleted {
  _id: string;
  name: string;
  ownerId: string;
  orgId?: string;
  created: Date;
  updated?: Date;
  _syncSeq?: number;
  _syncPrevStream?: string | null;
}

const syncStuffSchema = new Schema<SyncStuff>({
  name: {description: "The name of the item", required: true, type: String},
  orgId: {description: "The organization this item belongs to", type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
syncStuffSchema.plugin(isDeletedPlugin);
syncStuffSchema.plugin(createdUpdatedPlugin);
syncStuffSchema.plugin(syncPlugin);
const SyncStuffModel = model<SyncStuff>("SyncStuff", syncStuffSchema);

// Has syncPlugin but is never registered — hooks must no-op.
const unregisteredSchema = new Schema<SyncStuff>({
  name: {description: "The name of the item", type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
unregisteredSchema.plugin(isDeletedPlugin);
unregisteredSchema.plugin(syncPlugin);
const UnregisteredModel = model<SyncStuff>("SyncUnregistered", unregisteredSchema);

// Missing isDeletedPlugin — registration must throw.
const noDeleteSchema = new Schema({
  name: {description: "The name of the item", type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
noDeleteSchema.plugin(syncPlugin);
const NoDeleteModel = model("SyncNoDelete", noDeleteSchema);

// Missing syncPlugin — registration must throw.
const noPluginSchema = new Schema({
  name: {description: "The name of the item", type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
noPluginSchema.plugin(isDeletedPlugin);
const NoPluginModel = model("SyncNoPlugin", noPluginSchema);

const stubOptions = {
  permissions: {create: [], delete: [], list: [], read: [], update: []},
} as unknown as ModelRouterOptions<any>;

const ownerConfig: SyncConfig = {scope: {type: "owner"}};

const registerStuff = (config: SyncConfig = ownerConfig): void => {
  registerSync({
    config,
    model: SyncStuffModel as any,
    options: stubOptions,
    routePath: "/syncStuff",
  });
};

describe("sync streams", () => {
  it("resolves owner scope with the default field", () => {
    expect(getScopeField({type: "owner"})).toBe("ownerId");
    expect(
      resolveStreamForDoc({collectionTag: "todos", doc: {ownerId: "u1"}, scope: {type: "owner"}})
    ).toBe("todos|owner:u1");
  });

  it("resolves owner scope with a custom field", () => {
    expect(getScopeField({field: "userId", type: "owner"})).toBe("userId");
    expect(
      resolveStreamForDoc({
        collectionTag: "todos",
        doc: {userId: "u2"},
        scope: {field: "userId", type: "owner"},
      })
    ).toBe("todos|owner:u2");
  });

  it("resolves tenant scope", () => {
    expect(getScopeField({field: "orgId", type: "tenant"})).toBe("orgId");
    expect(
      resolveStreamForDoc({
        collectionTag: "projects",
        doc: {orgId: "org9"},
        scope: {field: "orgId", type: "tenant"},
      })
    ).toBe("projects|tenant:org9");
  });

  it("resolves broadcast scope", () => {
    expect(getScopeField({type: "broadcast"})).toBeNull();
    expect(
      resolveStreamForDoc({collectionTag: "banners", doc: {}, scope: {type: "broadcast"}})
    ).toBe("banners|all");
  });

  it("resolves custom scope via resolver function", () => {
    const scope = (doc: Record<string, unknown>): string => `${doc.region}`;
    expect(getScopeField(scope)).toBeNull();
    expect(resolveStreamForDoc({collectionTag: "shops", doc: {region: "eu"}, scope})).toBe(
      "shops|custom:eu"
    );
    expect(streamForScopeValue({collectionTag: "shops", scope, scopeValue: "us"})).toBe(
      "shops|custom:us"
    );
  });
});

describe("registerSync validation", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(() => {
    clearSyncRegistry();
  });

  it("throws when the model lacks soft delete", () => {
    expect(() =>
      registerSync({
        config: ownerConfig,
        model: NoDeleteModel as any,
        options: stubOptions,
        routePath: "/noDelete",
      })
    ).toThrow(/soft delete/);
  });

  it("throws when the model lacks syncPlugin", () => {
    expect(() =>
      registerSync({
        config: ownerConfig,
        model: NoPluginModel as any,
        options: stubOptions,
        routePath: "/noPlugin",
      })
    ).toThrow(/syncPlugin/);
  });

  it("throws when the scope field does not exist on the schema", () => {
    expect(() =>
      registerSync({
        config: {scope: {field: "workspaceId", type: "tenant"}},
        model: SyncStuffModel as any,
        options: stubOptions,
        routePath: "/syncStuff",
      })
    ).toThrow(/workspaceId/);
  });

  it("throws on duplicate registration", () => {
    registerStuff();
    expect(() => registerStuff()).toThrow(/already registered/);
  });

  it("registers a compliant model and exposes lookup helpers", () => {
    registerStuff();
    expect(getSyncRegistry()).toHaveLength(1);
    expect(findSyncEntryByModelName("SyncStuff")?.collectionTag).toBe("syncStuff");
    expect(findSyncEntryByCollectionTag("syncStuff")?.modelName).toBe("SyncStuff");
  });
});

describe("modelRouter sync option", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(() => {
    clearSyncRegistry();
  });

  it("registers the model for sync in the three-argument form", () => {
    const registration = modelRouter("/syncStuff", SyncStuffModel as any, {
      ...stubOptions,
      sync: ownerConfig,
    });
    expect((registration as {__type: string}).__type).toBe("modelRouter");
    expect(findSyncEntryByCollectionTag("syncStuff")).toBeDefined();
  });

  it("does not register in the two-argument form", () => {
    modelRouter(SyncStuffModel as any, {...stubOptions, sync: ownerConfig});
    expect(findSyncEntryByCollectionTag("syncStuff")).toBeUndefined();
  });
});

describe("syncPlugin seq stamping", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    registerStuff();
    await Promise.all([
      SyncStuffModel.deleteMany({}).catch(() => undefined),
      UnregisteredModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
    ]);
  });

  it("stamps monotonic seqs per stream across create and update", async () => {
    const doc = await SyncStuffModel.create({name: "one", ownerId: "u1"});
    expect(doc._syncSeq).toBe(1);
    expect(doc._syncPrevStream).toBeNull();

    doc.name = "one updated";
    await doc.save();
    expect(doc._syncSeq).toBe(2);
    expect(doc._syncPrevStream).toBeNull();
  });

  it("keeps independent streams per owner", async () => {
    const a = await SyncStuffModel.create({name: "a", ownerId: "userA"});
    const b = await SyncStuffModel.create({name: "b", ownerId: "userB"});
    expect(a._syncSeq).toBe(1);
    expect(b._syncSeq).toBe(1);
    const counters = await SyncCounter.find({}).sort({stream: 1});
    expect(counters.map((c) => c.stream)).toEqual([
      "syncStuff|owner:userA",
      "syncStuff|owner:userB",
    ]);
  });

  it("assigns unique seqs under concurrent writes to one stream", async () => {
    const docs = await Promise.all(
      Array.from({length: 10}, (_, i) =>
        SyncStuffModel.create({name: `item ${i}`, ownerId: "concurrent"})
      )
    );
    const seqs = docs.map((d) => d._syncSeq).sort((x, y) => (x ?? 0) - (y ?? 0));
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("does not consume a seq when validation fails", async () => {
    await expect(SyncStuffModel.create({ownerId: "u1"} as any)).rejects.toThrow();
    const doc = await SyncStuffModel.create({name: "valid", ownerId: "u1"});
    expect(doc._syncSeq).toBe(1);
  });

  it("stamps on Model.updateOne", async () => {
    const doc = await SyncStuffModel.create({name: "q", ownerId: "u1"});
    await SyncStuffModel.updateOne({_id: doc._id}, {$set: {name: "q2"}});
    const updated = await SyncStuffModel.findById(doc._id);
    expect(updated?._syncSeq).toBe(2);
    expect(updated?.name).toBe("q2");
  });

  it("stamps on findOneAndUpdate", async () => {
    const doc = await SyncStuffModel.create({name: "f", ownerId: "u1"});
    const updated = await SyncStuffModel.findOneAndUpdate(
      {_id: doc._id},
      {$set: {name: "f2"}},
      {new: true}
    );
    expect(updated?._syncSeq).toBe(2);
  });

  it("stamps on replaceOne", async () => {
    const doc = await SyncStuffModel.create({name: "r", ownerId: "u1"});
    await SyncStuffModel.replaceOne({_id: doc._id}, {name: "r2", ownerId: "u1"});
    const replaced = await SyncStuffModel.findById(doc._id);
    expect(replaced?._syncSeq).toBe(2);
    expect(replaced?.name).toBe("r2");
  });

  it("stamps ascending seqs on insertMany, grouped by stream", async () => {
    const docs = await SyncStuffModel.insertMany([
      {name: "m1", ownerId: "bulkA"},
      {name: "m2", ownerId: "bulkA"},
      {name: "m3", ownerId: "bulkB"},
    ]);
    const bulkA = docs.filter((d) => d.ownerId === "bulkA").map((d) => d._syncSeq);
    const bulkB = docs.filter((d) => d.ownerId === "bulkB").map((d) => d._syncSeq);
    expect(bulkA).toEqual([1, 2]);
    expect(bulkB).toEqual([1]);
  });

  it("no-ops for models with the plugin that are not registered", async () => {
    const doc = await UnregisteredModel.create({name: "free", ownerId: "u1"});
    expect(doc._syncSeq).toBeUndefined();
  });

  it("records _syncPrevStream when a save moves the doc between owners", async () => {
    const doc = await SyncStuffModel.create({name: "mover", ownerId: "oldOwner"});
    const loaded = await SyncStuffModel.findById(doc._id);
    expect(loaded).toBeDefined();
    if (!loaded) {
      throw new Error("doc not found");
    }
    loaded.ownerId = "newOwner";
    await loaded.save();
    expect(loaded._syncPrevStream).toBe("syncStuff|owner:oldOwner");
    expect(loaded._syncSeq).toBe(1); // first write on the newOwner stream

    loaded.name = "no move this time";
    await loaded.save();
    expect(loaded._syncPrevStream).toBeNull();
  });

  it("records _syncPrevStream when findOneAndUpdate moves the doc between owners", async () => {
    const doc = await SyncStuffModel.create({name: "qmover", ownerId: "oldOwner"});
    const updated = await SyncStuffModel.findOneAndUpdate(
      {_id: doc._id},
      {$set: {ownerId: "newOwner"}},
      {new: true}
    );
    expect(updated?._syncPrevStream).toBe("syncStuff|owner:oldOwner");
    expect(updated?._syncSeq).toBe(1);
  });

  it("sequences soft deletes as tombstones", async () => {
    const doc = await SyncStuffModel.create({name: "bye", ownerId: "u1"});
    doc.deleted = true;
    await doc.save();
    expect(doc._syncSeq).toBe(2);
  });

  it("stamps updates to existing tombstones (the internal lookup sees deleted docs)", async () => {
    const doc = await SyncStuffModel.create({name: "ghost", ownerId: "u1"});
    doc.deleted = true;
    await doc.save();
    await SyncStuffModel.updateOne({_id: doc._id}, {$set: {name: "ghost2"}});
    const revived = await SyncStuffModel.find({_id: doc._id, deleted: true});
    expect(revived[0]?._syncSeq).toBe(3);
    expect(revived[0]?.name).toBe("ghost2");
  });

  it("leaves updates that match nothing unstamped and unclaimed", async () => {
    await SyncStuffModel.updateOne({_id: "000000000000000000000000"}, {$set: {name: "nobody"}});
    const counters = await SyncCounter.find({});
    expect(counters).toHaveLength(0);
  });
});

describe("syncPlugin unsupported write guards", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    clearSyncRegistry();
    registerStuff();
    await SyncCounter.deleteMany({});
  });

  it("throws on updateMany", async () => {
    await expect(
      SyncStuffModel.updateMany({ownerId: "u1"}, {$set: {name: "x"}}).exec()
    ).rejects.toThrow(/updateMany is not supported/);
  });

  it("throws on deleteMany", async () => {
    await expect(SyncStuffModel.deleteMany({ownerId: "u1"}).exec()).rejects.toThrow(
      /deleteMany is not supported/
    );
  });

  it("throws on query deleteOne", async () => {
    await expect(SyncStuffModel.deleteOne({ownerId: "u1"}).exec()).rejects.toThrow(
      /deleteOne is not supported/
    );
  });

  it("throws on findOneAndDelete", async () => {
    await expect(SyncStuffModel.findOneAndDelete({ownerId: "u1"}).exec()).rejects.toThrow(
      /findOneAndDelete is not supported/
    );
  });

  it("throws on document deleteOne (hard delete)", async () => {
    const doc = await SyncStuffModel.create({name: "hard", ownerId: "u1"});
    await expect(doc.deleteOne().exec()).rejects.toThrow(/hard delete/);
  });

  it("allows all of these on unregistered models", async () => {
    await UnregisteredModel.create({name: "temp", ownerId: "u1"});
    await expect(
      UnregisteredModel.updateMany({ownerId: "u1"}, {$set: {name: "y"}}).exec()
    ).resolves.toBeDefined();
    await expect(UnregisteredModel.deleteMany({ownerId: "u1"}).exec()).resolves.toBeDefined();
  });
});

describe("claimSyncSeqs", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    await SyncCounter.deleteMany({});
  });

  it("claims monotonic seqs and batch ranges", async () => {
    expect(await claimSyncSeqs({stream: "s|a"})).toBe(1);
    expect(await claimSyncSeqs({count: 5, stream: "s|a"})).toBe(6);
    expect(await claimSyncSeqs({stream: "s|a"})).toBe(7);
    expect(await claimSyncSeqs({stream: "s|b"})).toBe(1);
  });

  it("survives concurrent first claims for a new stream", async () => {
    const results = await Promise.all(
      Array.from({length: 5}, () => claimSyncSeqs({stream: "s|fresh"}))
    );
    expect(results.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("getOrCreateSyncKeyMaterial", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    await SyncKey.deleteMany({});
  });

  it("creates on first call and returns the same material afterwards", async () => {
    const first = await getOrCreateSyncKeyMaterial({userId: "user1"});
    const second = await getOrCreateSyncKeyMaterial({userId: "user1"});
    expect(first).toBe(second);
    expect(Buffer.from(first, "base64")).toHaveLength(32);
  });

  it("gives distinct users distinct material", async () => {
    const a = await getOrCreateSyncKeyMaterial({userId: "userA"});
    const b = await getOrCreateSyncKeyMaterial({userId: "userB"});
    expect(a).not.toBe(b);
  });

  it("converges concurrent first calls on one persisted value", async () => {
    const results = await Promise.all(
      Array.from({length: 5}, () => getOrCreateSyncKeyMaterial({userId: "racer"}))
    );
    expect(new Set(results).size).toBe(1);
    const docs = await SyncKey.find({userId: "racer"});
    expect(docs).toHaveLength(1);
    expect(docs[0].keyMaterial).toBe(results[0]);
  });
});
