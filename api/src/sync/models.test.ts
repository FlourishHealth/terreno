import {beforeAll, beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";
import {setupDb} from "../tests";
import {
  claimSyncSeqs,
  computeStableFrontier,
  confirmSyncSeqs,
  ensureSyncModelIndexes,
  getOrCreateSyncKeyMaterial,
  PENDING_CLAIM_LEASE_MS,
  recordCompactedThroughSeq,
  releaseSyncSeqs,
  SyncCounter,
  SyncScopeMove,
} from "./models";

/**
 * Coverage for the sync bookkeeping models' branches that the protocol suites never
 * reach: the session-backed claim fast path, the upsert-race retry, the empty-seq
 * short-circuits in confirm/release, the `seq <= 0` watermark guard, and the legacy
 * TTL-index drop (both the found and the failing branch).
 */

type LooseFindOneAndUpdate = (
  filter: Record<string, unknown>,
  update: unknown,
  options?: Record<string, unknown>
) => Promise<unknown>;

type LooseUpdateOne = (
  filter: Record<string, unknown>,
  update: unknown,
  options?: Record<string, unknown>
) => Promise<unknown>;

/**
 * Replace `SyncCounter.findOneAndUpdate` with `stub`. Returns a restore function and the
 * original, bound implementation so a stub can delegate to the real claim.
 */
const stubFindOneAndUpdate = (
  build: (original: LooseFindOneAndUpdate) => LooseFindOneAndUpdate
): (() => void) => {
  const original = SyncCounter.findOneAndUpdate.bind(
    SyncCounter
  ) as unknown as LooseFindOneAndUpdate;
  Object.assign(SyncCounter, {
    findOneAndUpdate: build(original) as unknown as typeof SyncCounter.findOneAndUpdate,
  });
  return () => {
    Object.assign(SyncCounter, {findOneAndUpdate: original});
  };
};

describe("claimSyncSeqs", () => {
  beforeAll(async () => {
    await setupDb();
    await SyncCounter.ensureIndexes();
  });

  beforeEach(async () => {
    await SyncCounter.deleteMany({});
  });

  it("skips the pending registry for a session-backed claim", async () => {
    const stream = "models-session|owner:1";
    const session = await mongoose.startSession();
    try {
      const claim = await claimSyncSeqs({count: 3, session, stream});
      assert.strictEqual(claim.lastSeq, 3);
      assert.deepEqual(claim.seqs, [1, 2, 3]);
      // The $inc commits with the caller's write, so there is no uncommitted window to
      // fence and nothing for confirmSyncSeqs to clear.
      assert.isFalse(claim.registered);
      const counter = await SyncCounter.findOne({stream});
      assert.strictEqual(counter?.seq, 3);
      assert.lengthOf(counter?.pending ?? [], 0);
    } finally {
      await session.endSession();
    }
  });

  it("retries the claim once when two concurrent upserts race (E11000)", async () => {
    const stream = "models-race|owner:1";
    let threw = false;
    const restore = stubFindOneAndUpdate((original) => async (filter, update, options) => {
      if (!threw) {
        threw = true;
        throw Object.assign(new Error("duplicate key"), {code: 11000});
      }
      return original(filter, update, options);
    });
    try {
      const claim = await claimSyncSeqs({stream});
      assert.isTrue(threw);
      assert.strictEqual(claim.lastSeq, 1);
      assert.isTrue(claim.registered);
    } finally {
      restore();
    }
  });

  it("rethrows a claim failure that is not the upsert race", async () => {
    const restore = stubFindOneAndUpdate(() => async () => {
      throw Object.assign(new Error("unrelated write failure"), {code: 66});
    });
    try {
      let caught: unknown;
      try {
        await claimSyncSeqs({stream: "models-error|owner:1"});
      } catch (error: unknown) {
        caught = error;
      }
      assert.instanceOf(caught, Error);
      assert.strictEqual((caught as Error).message, "unrelated write failure");
    } finally {
      restore();
    }
  });
});

describe("confirmSyncSeqs / releaseSyncSeqs", () => {
  beforeAll(async () => {
    await setupDb();
  });

  /** Counts `$pull` updates issued against the counter while `run` executes. */
  const countPulls = async (run: () => Promise<void>): Promise<number> => {
    let pulls = 0;
    const original = SyncCounter.updateOne.bind(SyncCounter) as unknown as LooseUpdateOne;
    const stub = (async (
      filter: Record<string, unknown>,
      update: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => {
      if (update && Object.hasOwn(update, "$pull")) {
        pulls += 1;
      }
      return original(filter, update, options);
    }) as unknown as typeof SyncCounter.updateOne;
    Object.assign(SyncCounter, {updateOne: stub});
    try {
      await run();
    } finally {
      Object.assign(SyncCounter, {updateOne: original});
    }
    return pulls;
  };

  it("treats an empty confirm as already cleared without touching the counter", async () => {
    let result: {cleared: boolean} | undefined;
    const pulls = await countPulls(async () => {
      result = await confirmSyncSeqs({seqs: [], stream: "models-empty|owner:1"});
    });
    assert.deepEqual(result, {cleared: true});
    assert.strictEqual(pulls, 0);
  });

  it("no-ops an empty release without touching the counter", async () => {
    const pulls = await countPulls(async () => {
      await releaseSyncSeqs({seqs: [], stream: "models-empty|owner:1"});
    });
    assert.strictEqual(pulls, 0);
  });
});

describe("computeStableFrontier", () => {
  beforeAll(async () => {
    await setupDb();
  });

  it("still reports the frontier when the stale-claim cleanup fails", async () => {
    const stream = "models-stale|owner:1";
    await SyncCounter.deleteMany({stream});
    await SyncCounter.create({
      pending: [{claimedAt: new Date(Date.now() - PENDING_CLAIM_LEASE_MS - 1_000), seq: 4}],
      seq: 4,
      stream,
    });

    const original = SyncCounter.updateOne.bind(SyncCounter) as unknown as LooseUpdateOne;
    Object.assign(SyncCounter, {
      updateOne: async () => {
        throw new Error("simulated stale-claim $pull failure");
      },
    });
    try {
      // The opportunistic cleanup is best-effort: a failed $pull must not stall the
      // frontier, which is already the head because every claim aged out.
      assert.strictEqual(await computeStableFrontier({stream}), 4);
    } finally {
      Object.assign(SyncCounter, {updateOne: original});
    }
  });
});

describe("recordCompactedThroughSeq", () => {
  beforeAll(async () => {
    await setupDb();
  });

  it("ignores a non-positive watermark", async () => {
    const stream = "models-watermark|owner:1";
    await SyncCounter.deleteMany({stream});
    await SyncCounter.create({compactedThroughSeq: 5, seq: 5, stream});
    await recordCompactedThroughSeq({seq: 0, stream});
    const counter = await SyncCounter.findOne({stream});
    assert.strictEqual(counter?.compactedThroughSeq, 5);
  });
});

describe("ensureSyncModelIndexes", () => {
  beforeAll(async () => {
    await setupDb();
  });

  it("drops the legacy SyncScopeMove TTL index", async () => {
    await SyncScopeMove.createCollection();
    const existing = await SyncScopeMove.collection.indexes();
    if (!existing.some((index) => index.name === "created_1")) {
      await SyncScopeMove.collection.createIndex({created: 1}, {expireAfterSeconds: 90 * 86_400});
    }

    await ensureSyncModelIndexes();

    const indexes = await SyncScopeMove.collection.indexes();
    const legacy = indexes.find(
      (index) => index.name === "created_1" && index.expireAfterSeconds !== undefined
    );
    assert.isUndefined(legacy);
  });

  it("logs and continues when the legacy index lookup fails", async () => {
    const collection = SyncScopeMove.collection;
    const original = collection.indexes.bind(collection);
    Object.assign(collection, {
      indexes: async () => {
        throw new Error("simulated index listing failure");
      },
    });
    try {
      // A leftover TTL index degrades retention accounting but must never block startup.
      await ensureSyncModelIndexes();
    } finally {
      Object.assign(collection, {indexes: original});
    }
  });
});

describe("getOrCreateSyncKeyMaterial", () => {
  beforeAll(async () => {
    await setupDb();
  });

  it("returns the persisted material on every later call", async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const first = await getOrCreateSyncKeyMaterial({userId});
    const second = await getOrCreateSyncKeyMaterial({userId});
    assert.strictEqual(second, first);
    assert.strictEqual(Buffer.from(first, "base64").length, 32);
  });
});
