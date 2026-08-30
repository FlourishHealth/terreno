import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";

import {setupTestData} from "../tests";
import {createRateLimitStore} from "./createStore";
import {createMongoRateLimitStore, RATE_LIMIT_HITS_COLLECTION} from "./mongoStore";

describe("mongo rate limit store", () => {
  beforeEach(async () => {
    await setupTestData();
    const db = mongoose.connection.db;
    if (db) {
      await db.collection(RATE_LIMIT_HITS_COLLECTION).deleteMany({});
    }
  });

  it("isolates keys and resets after the window", async () => {
    const store = createRateLimitStore({store: "mongo"});
    const t0 = 1_000_000;
    const a1 = await store.consume({key: "a", max: 2, now: t0, windowMs: 1000});
    const a2 = await store.consume({key: "a", max: 2, now: t0 + 10, windowMs: 1000});
    const a3 = await store.consume({key: "a", max: 2, now: t0 + 20, windowMs: 1000});
    const b1 = await store.consume({key: "b", max: 2, now: t0, windowMs: 1000});
    assert.isTrue(a1.allowed);
    assert.isTrue(a2.allowed);
    assert.isFalse(a3.allowed);
    assert.isTrue(b1.allowed);
    const after = await store.consume({key: "a", max: 2, now: t0 + 1001, windowMs: 1000});
    assert.isTrue(after.allowed);
  });

  it("does not expose rateLimitHits as a modelRouter catalog path", () => {
    const names = mongoose.modelNames();
    assert.notInclude(names, RATE_LIMIT_HITS_COLLECTION);
    assert.notInclude(names, "RateLimitHits");
  });

  it("creates a TTL index on expiresAt", async () => {
    const store = createMongoRateLimitStore();
    await store.consume({key: "idx", max: 1, now: 1, windowMs: 1000});
    const db = mongoose.connection.db;
    assert.ok(db);
    const indexes = await db.collection(RATE_LIMIT_HITS_COLLECTION).indexes();
    const ttl = indexes.find((index) => index.key.expiresAt === 1);
    assert.ok(ttl);
    assert.equal(ttl.expireAfterSeconds, 0);
  });

  it("does not allow more than max under concurrent consumes", async () => {
    const store = createMongoRateLimitStore();
    const now = 9_000_000;
    const results = await Promise.all(
      Array.from({length: 20}, () => store.consume({key: "burst", max: 5, now, windowMs: 60_000}))
    );
    const allowed = results.filter((result) => result.allowed).length;
    assert.equal(allowed, 5);
  });
});
