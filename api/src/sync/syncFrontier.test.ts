// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeAll, beforeEach, describe, expect, it} from "bun:test";
import {model, Schema} from "mongoose";
import type {ModelRouterOptions} from "../api";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {setupDb} from "../tests";
import {
  claimSyncSeqs,
  computeStableFrontier,
  confirmSyncSeqs,
  PENDING_CLAIM_LEASE_MS,
  SyncCounter,
  SyncScopeMove,
} from "./models";
import {clearSyncRegistry, registerSync} from "./registry";
import {syncPlugin} from "./syncSeqPlugin";
import type {SyncConfig} from "./types";

/**
 * C1 stable-frontier + C4 scope-move-marker tests.
 *
 * The stable frontier is what guarantees no committed document is ever permanently
 * skipped by cursor catch-up: a cursor may advance to seq N only when every seq <= N in
 * the stream is committed (its claim confirmed) or reclaimed (stale lease). These tests
 * exercise the claim/confirm/frontier math directly (forced commit inversion, random
 * interleavings with crashes) and the write-path guards (m9/m10) + scope-move markers.
 */

interface FrontierStuff extends IsDeleted {
  _id: string;
  name: string;
  ownerId: string;
  orgId?: string;
  created: Date;
  updated?: Date;
  _syncSeq?: number;
  _syncPrevStream?: string | null;
}

const frontierSchema = new Schema<FrontierStuff>({
  name: {description: "The name of the item", required: true, type: String},
  orgId: {description: "The organization this item belongs to", type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
frontierSchema.plugin(isDeletedPlugin);
frontierSchema.plugin(createdUpdatedPlugin);
frontierSchema.plugin(syncPlugin);
const FrontierModel = model<FrontierStuff>("FrontierStuff", frontierSchema);

const stubOptions = {
  permissions: {create: [], delete: [], list: [], read: [], update: []},
} as unknown as ModelRouterOptions<any>;

describe("C1 claimSyncSeqs / confirmSyncSeqs / computeStableFrontier", () => {
  beforeAll(async () => {
    await setupDb();
    await SyncCounter.ensureIndexes();
  });

  beforeEach(async () => {
    await SyncCounter.deleteMany({});
    await SyncScopeMove.deleteMany({});
  });

  it("empty stream frontier is 0; fresh stamped stream frontier is the head once confirmed", async () => {
    expect(await computeStableFrontier({stream: "f|empty"})).toBe(0);
    const claim = await claimSyncSeqs({stream: "f|a"});
    expect(claim.lastSeq).toBe(1);
    expect(claim.registered).toBe(true);
    // Before confirm, seq 1 is pending → frontier holds below it.
    expect(await computeStableFrontier({stream: "f|a"})).toBe(0);
    await confirmSyncSeqs({seqs: claim.seqs, stream: "f|a"});
    expect(await computeStableFrontier({stream: "f|a"})).toBe(1);
  });

  it("session-backed claim registers nothing (frontier is the head immediately)", async () => {
    // A session-backed claim commits atomically with its write — no pending window.
    // We simulate by manually seeding the counter head without pending entries.
    await SyncCounter.create({pending: [], seq: 5, stream: "f|session"});
    expect(await computeStableFrontier({stream: "f|session"})).toBe(5);
  });

  it("forced commit inversion: frontier holds at 4 while seq 5 is pending, jumps to 6 after 5 confirms", async () => {
    const stream = "f|inv";
    // Seed a committed history up to seq 4 (no pending).
    await SyncCounter.create({pending: [], seq: 4, stream});
    // Writer A claims 5, writer B claims 6; B commits (confirms) FIRST (inversion).
    const claimA = await claimSyncSeqs({stream}); // 5
    const claimB = await claimSyncSeqs({stream}); // 6
    expect(claimA.lastSeq).toBe(5);
    expect(claimB.lastSeq).toBe(6);
    await confirmSyncSeqs({seqs: claimB.seqs, stream}); // 6 committed, 5 still pending
    // Frontier must stay at 4 — advancing to 6 would permanently skip A's seq 5.
    expect(await computeStableFrontier({stream})).toBe(4);
    // A commits.
    await confirmSyncSeqs({seqs: claimA.seqs, stream});
    // Now everything <= 6 is committed → frontier jumps to the head.
    expect(await computeStableFrontier({stream})).toBe(6);
  });

  it("stale pending claim (crashed writer) is reclaimed at read time so the frontier is not frozen", async () => {
    const stream = "f|stale";
    await SyncCounter.create({pending: [], seq: 3, stream});
    // Claim 4 and 5; 4 will be "stale" (crashed writer never confirmed).
    const claim4 = await claimSyncSeqs({stream}); // 4
    const claim5 = await claimSyncSeqs({stream}); // 5
    await confirmSyncSeqs({seqs: claim5.seqs, stream}); // 5 committed, 4 pending
    // Age out claim 4's pending entry beyond the lease.
    const stale = new Date(Date.now() - PENDING_CLAIM_LEASE_MS - 1000);
    await SyncCounter.updateOne(
      {stream},
      {$set: {"pending.$[e].claimedAt": stale}},
      {arrayFilters: [{"e.seq": claim4.lastSeq}]}
    );
    // Frontier excludes the stale claim → advances to the head.
    expect(await computeStableFrontier({stream})).toBe(5);
    // The stale entry was opportunistically pulled.
    const counter = await SyncCounter.findOne({stream});
    expect((counter?.pending ?? []).some((p) => p.seq === 4)).toBe(false);
  });

  it("batch claim materializes the full range and confirms all at once", async () => {
    const stream = "f|batch";
    const claim = await claimSyncSeqs({count: 3, stream});
    expect(claim.seqs).toEqual([1, 2, 3]);
    expect(await computeStableFrontier({stream})).toBe(0);
    await confirmSyncSeqs({seqs: claim.seqs, stream});
    expect(await computeStableFrontier({stream})).toBe(3);
  });

  it("property-style: N writers, random commit interleavings + random crashes, no committed seq skipped", async () => {
    // 100 seeds: each seed claims N seqs, confirms a random subset in random order,
    // "crashes" the rest (never confirmed). After forcing every unconfirmed claim stale,
    // the frontier must equal the head IFF every claim was confirmed-or-stale (which it
    // is, since we force staleness) — and critically, the frontier must never sit ABOVE
    // a seq whose claim is still live-pending.
    for (let seed = 0; seed < 100; seed++) {
      const stream = `f|prop-${seed}`;
      await SyncCounter.deleteMany({stream});
      const n = 2 + (seed % 6); // 2..7 writers
      const claims: Awaited<ReturnType<typeof claimSyncSeqs>>[] = [];
      for (let i = 0; i < n; i++) {
        claims.push(await claimSyncSeqs({stream}));
      }
      // Randomly pick a subset to confirm, in shuffled order.
      const order = claims
        .map((_, i) => i)
        .sort(() => (seed % 2 === 0 ? 1 : -1) * (Math.random() - 0.5));
      const confirmed = new Set<number>();
      for (const idx of order) {
        if (Math.random() < 0.6) {
          await confirmSyncSeqs({seqs: claims[idx].seqs, stream});
          confirmed.add(claims[idx].lastSeq);
        }
      }
      // Invariant check BEFORE aging: frontier must be < the lowest UNconfirmed seq,
      // i.e. it never sits at or above a live-pending claim.
      const frontier = await computeStableFrontier({stream});
      const unconfirmed = claims.map((c) => c.lastSeq).filter((s) => !confirmed.has(s));
      if (unconfirmed.length > 0) {
        const minUnconfirmed = Math.min(...unconfirmed);
        expect(frontier).toBeLessThan(minUnconfirmed);
      }
      // Now force every remaining pending entry stale (simulate crashed writers) and
      // re-read: a full catch-up at the resulting frontier must include every CONFIRMED
      // seq (none permanently skipped).
      const stale = new Date(Date.now() - PENDING_CLAIM_LEASE_MS - 5000);
      await SyncCounter.updateOne({stream}, {$set: {"pending.$[].claimedAt": stale}});
      const finalFrontier = await computeStableFrontier({stream});
      for (const seq of confirmed) {
        expect(seq).toBeLessThanOrEqual(finalFrontier);
      }
    }
  });
});

describe("C1 write-path guards (m9 / m10) + C4 scope-move markers", () => {
  beforeAll(async () => {
    await setupDb();
    await SyncCounter.ensureIndexes();
    clearSyncRegistry();
    registerSync({
      config: {scope: {field: "orgId", type: "tenant"}} as SyncConfig,
      model: FrontierModel as any,
      options: stubOptions,
      routePath: "/frontierStuff",
    });
  });

  beforeEach(async () => {
    // deleteMany is blocked on the synced model; clear via the native collection.
    await FrontierModel.collection.deleteMany({});
    await SyncCounter.deleteMany({});
    await SyncScopeMove.deleteMany({});
  });

  it("m10: a save with no meaningful modified paths claims no new seq", async () => {
    const doc = await FrontierModel.create({name: "n", orgId: "org1", ownerId: "u1"});
    const firstSeq = doc._syncSeq;
    // Re-save without changing anything.
    await doc.save();
    expect(doc._syncSeq).toBe(firstSeq as number);
    // The stream's head did not advance beyond the create.
    const counter = await SyncCounter.findOne({stream: "frontierStuff|tenant:org1"});
    expect(counter?.seq).toBe(firstSeq as number);
  });

  it("m10: a meaningful save DOES claim a new seq", async () => {
    const doc = await FrontierModel.create({name: "n", orgId: "org1", ownerId: "u1"});
    const firstSeq = doc._syncSeq as number;
    doc.name = "renamed";
    await doc.save();
    expect(doc._syncSeq).toBeGreaterThan(firstSeq);
  });

  it("m9: a query-write with a non-_id filter throws the loud error", async () => {
    await FrontierModel.create({name: "n", orgId: "org1", ownerId: "u1"});
    await expect(FrontierModel.updateOne({name: "n"}, {$set: {name: "x"}}).exec()).rejects.toThrow(
      /must target a single document by _id/
    );
  });

  it("m9: an _id-targeted query-write is allowed", async () => {
    const doc = await FrontierModel.create({name: "n", orgId: "org1", ownerId: "u1"});
    await FrontierModel.updateOne({_id: doc._id}, {$set: {name: "renamed"}});
    const reloaded = await FrontierModel.findById(doc._id);
    expect(reloaded?.name).toBe("renamed");
  });

  it("m8/C6: upsert:true on a query-write throws", async () => {
    await expect(
      FrontierModel.updateOne(
        {_id: "000000000000000000000001"},
        {$set: {name: "x", orgId: "org1", ownerId: "u1"}},
        {upsert: true}
      ).exec()
    ).rejects.toThrow(/upsert:true is not supported/);
  });

  it("C4: a scope move writes a durable SyncScopeMove marker on the OLD stream", async () => {
    const doc = await FrontierModel.create({name: "n", orgId: "org1", ownerId: "u1"});
    doc.orgId = "org2";
    await doc.save();
    const markers = await SyncScopeMove.find({entityId: String(doc._id)});
    expect(markers).toHaveLength(1);
    expect(markers[0].fromStream).toBe("frontierStuff|tenant:org1");
    expect(markers[0].toStream).toBe("frontierStuff|tenant:org2");
    expect(markers[0].collectionTag).toBe("frontierStuff");
    expect(markers[0].seq).toBeGreaterThan(0);
    // The marker's seq came from the OLD stream's counter.
    const oldCounter = await SyncCounter.findOne({stream: "frontierStuff|tenant:org1"});
    expect(oldCounter?.seq).toBeGreaterThanOrEqual(markers[0].seq);
  });

  it("C4: a racing second write cannot erase the marker (durable, not _syncPrevStream)", async () => {
    const doc = await FrontierModel.create({name: "n", orgId: "org1", ownerId: "u1"});
    doc.orgId = "org2";
    await doc.save();
    // A second write in the NEW stream resets _syncPrevStream to null...
    doc.name = "again";
    await doc.save();
    const reloaded = await FrontierModel.findById(doc._id);
    expect(reloaded?._syncPrevStream).toBeNull();
    // ...but the durable marker for the org1 -> org2 move survives.
    const markers = await SyncScopeMove.find({entityId: String(doc._id)});
    expect(markers.some((m) => m.fromStream === "frontierStuff|tenant:org1")).toBe(true);
  });

  it("C1 migration: pre-existing stamped docs (no pending) report frontier = head immediately", async () => {
    // Simulate a pre-deploy counter: a head with an empty pending array.
    await SyncCounter.create({pending: [], seq: 42, stream: "frontierStuff|tenant:legacy"});
    expect(await computeStableFrontier({stream: "frontierStuff|tenant:legacy"})).toBe(42);
  });
});
