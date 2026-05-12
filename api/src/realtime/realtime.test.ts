/**
 * Tests for the realtime module's pure functions and classes:
 *   - queryMatcher.ts (matchesQuery)
 *   - queryStore.ts (addQuerySubscription, removeQuerySubscription, etc.)
 *   - registry.ts (registerRealtime, getRealtimeRegistry, etc.)
 *   - realtimeApp.ts (RealtimeApp class — register, getIo, close)
 */

import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import express from "express";

import {matchesQuery} from "./queryMatcher";
import {RealtimeApp} from "./realtimeApp";
import {
  addQuerySubscription,
  clearQueryStore,
  computeQueryId,
  getQuerySubscriptionsForCollection,
  removeAllSocketQueries,
  removeQuerySubscription,
} from "./queryStore";
import {
  clearRealtimeRegistry,
  findRegistryEntryByCollection,
  findRegistryEntryByRoutePath,
  getRealtimeRegistry,
  registerRealtime,
} from "./registry";

// ─────────────────────────────────────────────────────────────────────────────
// queryMatcher tests
// ─────────────────────────────────────────────────────────────────────────────

describe("matchesQuery", () => {
  describe("direct equality", () => {
    it("matches string equality", () => {
      expect(matchesQuery({name: "Alice"}, {name: "Alice"})).toBe(true);
    });

    it("returns false for non-matching string", () => {
      expect(matchesQuery({name: "Alice"}, {name: "Bob"})).toBe(false);
    });

    it("matches numeric equality", () => {
      expect(matchesQuery({count: 5}, {count: 5})).toBe(true);
    });

    it("returns false for non-matching number", () => {
      expect(matchesQuery({count: 5}, {count: 6})).toBe(false);
    });

    it("matches boolean true", () => {
      expect(matchesQuery({active: true}, {active: true})).toBe(true);
    });

    it("returns false for non-matching boolean", () => {
      expect(matchesQuery({active: true}, {active: false})).toBe(false);
    });

    it("matches null value", () => {
      expect(matchesQuery({deleted: null}, {deleted: null})).toBe(true);
    });

    it("matches undefined/missing field", () => {
      expect(matchesQuery({}, {deleted: undefined})).toBe(true);
    });
  });

  describe("nested field access", () => {
    it("accesses nested fields via dot notation", () => {
      const doc = {user: {name: "Alice", age: 30}};
      expect(matchesQuery(doc, {"user.name": "Alice"})).toBe(true);
    });

    it("returns false when nested path doesn't match", () => {
      const doc = {user: {name: "Alice"}};
      expect(matchesQuery(doc, {"user.name": "Bob"})).toBe(false);
    });

    it("returns false when nested path is undefined", () => {
      const doc = {user: {}};
      expect(matchesQuery(doc, {"user.name": "Alice"})).toBe(false);
    });
  });

  describe("$eq operator", () => {
    it("matches with $eq", () => {
      expect(matchesQuery({count: 5}, {count: {$eq: 5}})).toBe(true);
    });

    it("returns false with $eq mismatch", () => {
      expect(matchesQuery({count: 5}, {count: {$eq: 6}})).toBe(false);
    });
  });

  describe("$ne operator", () => {
    it("matches when value is not equal", () => {
      expect(matchesQuery({status: "active"}, {status: {$ne: "inactive"}})).toBe(true);
    });

    it("returns false when value equals $ne operand", () => {
      expect(matchesQuery({status: "active"}, {status: {$ne: "active"}})).toBe(false);
    });
  });

  describe("$gt, $gte operators", () => {
    it("matches $gt", () => {
      expect(matchesQuery({score: 10}, {score: {$gt: 5}})).toBe(true);
    });

    it("returns false when not $gt", () => {
      expect(matchesQuery({score: 5}, {score: {$gt: 5}})).toBe(false);
    });

    it("matches $gte for equal value", () => {
      expect(matchesQuery({score: 5}, {score: {$gte: 5}})).toBe(true);
    });

    it("matches $gte for greater value", () => {
      expect(matchesQuery({score: 6}, {score: {$gte: 5}})).toBe(true);
    });

    it("returns false when not $gte", () => {
      expect(matchesQuery({score: 4}, {score: {$gte: 5}})).toBe(false);
    });
  });

  describe("$lt, $lte operators", () => {
    it("matches $lt", () => {
      expect(matchesQuery({score: 3}, {score: {$lt: 5}})).toBe(true);
    });

    it("returns false when not $lt", () => {
      expect(matchesQuery({score: 5}, {score: {$lt: 5}})).toBe(false);
    });

    it("matches $lte for equal value", () => {
      expect(matchesQuery({score: 5}, {score: {$lte: 5}})).toBe(true);
    });

    it("matches $lte for lesser value", () => {
      expect(matchesQuery({score: 4}, {score: {$lte: 5}})).toBe(true);
    });

    it("returns false when not $lte", () => {
      expect(matchesQuery({score: 6}, {score: {$lte: 5}})).toBe(false);
    });
  });

  describe("$in operator", () => {
    it("matches when value is in array", () => {
      expect(matchesQuery({status: "active"}, {status: {$in: ["active", "pending"]}})).toBe(true);
    });

    it("returns false when value is not in array", () => {
      expect(matchesQuery({status: "inactive"}, {status: {$in: ["active", "pending"]}})).toBe(
        false
      );
    });

    it("returns false when operand is not an array", () => {
      expect(matchesQuery({status: "active"}, {status: {$in: "active"}})).toBe(false);
    });
  });

  describe("$nin operator", () => {
    it("matches when value is not in array", () => {
      expect(matchesQuery({status: "inactive"}, {status: {$nin: ["active", "pending"]}})).toBe(
        true
      );
    });

    it("returns false when value is in array", () => {
      expect(matchesQuery({status: "active"}, {status: {$nin: ["active", "pending"]}})).toBe(
        false
      );
    });

    it("returns false when operand is not an array", () => {
      expect(matchesQuery({status: "active"}, {status: {$nin: "active"}})).toBe(false);
    });
  });

  describe("$exists operator", () => {
    it("matches when field exists and $exists is true", () => {
      expect(matchesQuery({name: "Alice"}, {name: {$exists: true}})).toBe(true);
    });

    it("returns false when field is missing and $exists is true", () => {
      expect(matchesQuery({}, {name: {$exists: true}})).toBe(false);
    });

    it("matches when field is missing and $exists is false", () => {
      expect(matchesQuery({}, {name: {$exists: false}})).toBe(true);
    });

    it("returns false when field exists and $exists is false", () => {
      expect(matchesQuery({name: "Alice"}, {name: {$exists: false}})).toBe(false);
    });
  });

  describe("$not operator", () => {
    it("negates a condition with $not", () => {
      expect(matchesQuery({count: 5}, {count: {$not: {$gt: 10}}})).toBe(true);
    });

    it("returns false when negated condition matches", () => {
      expect(matchesQuery({count: 15}, {count: {$not: {$gt: 10}}})).toBe(false);
    });
  });

  describe("$and operator", () => {
    it("matches when all conditions are true", () => {
      expect(
        matchesQuery({status: "active", count: 5}, {$and: [{status: "active"}, {count: 5}]})
      ).toBe(true);
    });

    it("returns false when one condition fails", () => {
      expect(
        matchesQuery({status: "active", count: 3}, {$and: [{status: "active"}, {count: 5}]})
      ).toBe(false);
    });

    it("returns false when $and operand is not an array", () => {
      expect(matchesQuery({status: "active"}, {$and: "invalid" as any})).toBe(false);
    });
  });

  describe("$or operator", () => {
    it("matches when any condition is true", () => {
      expect(
        matchesQuery({status: "inactive"}, {$or: [{status: "active"}, {status: "inactive"}]})
      ).toBe(true);
    });

    it("returns false when no conditions match", () => {
      expect(
        matchesQuery({status: "pending"}, {$or: [{status: "active"}, {status: "inactive"}]})
      ).toBe(false);
    });

    it("returns false when $or operand is not an array", () => {
      expect(matchesQuery({status: "active"}, {$or: "invalid" as any})).toBe(false);
    });
  });

  describe("unknown operator", () => {
    it("returns false for unknown operators (fail closed)", () => {
      expect(matchesQuery({name: "Alice"}, {name: {$regex: "Al"}})).toBe(false);
    });
  });

  describe("ObjectId-like values", () => {
    it("matches ObjectId-like objects via toString", () => {
      const fakeObjectId = {
        constructor: {name: "ObjectId"},
        toString: () => "507f1f77bcf86cd799439011",
      };
      const doc = {ownerId: fakeObjectId};
      expect(matchesQuery(doc, {ownerId: "507f1f77bcf86cd799439011"})).toBe(true);
    });
  });

  describe("array equality", () => {
    it("matches array conditions by JSON serialization", () => {
      expect(matchesQuery({tags: ["a", "b"]}, {tags: ["a", "b"]})).toBe(true);
    });

    it("returns false for different arrays", () => {
      expect(matchesQuery({tags: ["a", "b"]}, {tags: ["a", "c"]})).toBe(false);
    });
  });

  describe("empty query", () => {
    it("matches any document with empty query", () => {
      expect(matchesQuery({name: "Alice", count: 5}, {})).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// queryStore tests
// ─────────────────────────────────────────────────────────────────────────────

describe("queryStore", () => {
  beforeEach(() => {
    clearQueryStore();
  });

  afterEach(() => {
    clearQueryStore();
  });

  describe("computeQueryId", () => {
    it("produces a deterministic id from collection and query", () => {
      const id1 = computeQueryId("todos", {completed: false});
      const id2 = computeQueryId("todos", {completed: false});
      expect(id1).toBe(id2);
    });

    it("normalizes key order before computing id", () => {
      const id1 = computeQueryId("todos", {completed: false, ownerId: "abc"});
      const id2 = computeQueryId("todos", {ownerId: "abc", completed: false});
      expect(id1).toBe(id2);
    });

    it("includes the collection name in the id", () => {
      const id = computeQueryId("todos", {completed: false});
      expect(id.startsWith("todos:")).toBe(true);
    });

    it("produces different ids for different collections", () => {
      const id1 = computeQueryId("todos", {completed: false});
      const id2 = computeQueryId("items", {completed: false});
      expect(id1).not.toBe(id2);
    });

    it("produces different ids for different queries", () => {
      const id1 = computeQueryId("todos", {completed: false});
      const id2 = computeQueryId("todos", {completed: true});
      expect(id1).not.toBe(id2);
    });
  });

  describe("addQuerySubscription", () => {
    it("stores a subscription and makes it retrievable", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(1);
      expect(subs[0].queryId).toBe("todos:q1");
    });

    it("allows the same socket to subscribe to multiple queries", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket1", "todos", {completed: true}, "todos:q2");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(2);
    });

    it("allows multiple sockets to subscribe to the same query", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket2", "todos", {completed: false}, "todos:q1");
      const subs = getQuerySubscriptionsForCollection("todos");
      // Same queryId — deduplicated in the store
      expect(subs).toHaveLength(1);
    });
  });

  describe("removeQuerySubscription", () => {
    it("removes a specific query for a socket", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      removeQuerySubscription("socket1", "todos:q1");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(0);
    });

    it("does not remove a query if another socket still uses it", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket2", "todos", {completed: false}, "todos:q1");
      removeQuerySubscription("socket1", "todos:q1");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(1);
    });

    it("is safe to call for a socket that has no subscriptions", () => {
      expect(() => removeQuerySubscription("nonexistent", "todos:q1")).not.toThrow();
    });
  });

  describe("removeAllSocketQueries", () => {
    it("removes all subscriptions for a socket", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket1", "todos", {completed: true}, "todos:q2");
      removeAllSocketQueries("socket1");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(0);
    });

    it("preserves subscriptions for other sockets", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket2", "todos", {completed: true}, "todos:q2");
      removeAllSocketQueries("socket1");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(1);
      expect(subs[0].queryId).toBe("todos:q2");
    });

    it("is safe to call for a socket that has no subscriptions", () => {
      expect(() => removeAllSocketQueries("nonexistent")).not.toThrow();
    });

    it("only removes a shared query if no other sockets use it", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket2", "todos", {completed: false}, "todos:q1");
      removeAllSocketQueries("socket1");
      // socket2 still subscribes — query should remain
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs).toHaveLength(1);
    });
  });

  describe("getQuerySubscriptionsForCollection", () => {
    it("returns only subscriptions for the given collection", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket2", "items", {status: "active"}, "items:q1");
      const todoSubs = getQuerySubscriptionsForCollection("todos");
      expect(todoSubs).toHaveLength(1);
      expect(todoSubs[0].queryId).toBe("todos:q1");
    });

    it("returns an empty array when no subscriptions exist for collection", () => {
      const subs = getQuerySubscriptionsForCollection("nonexistent");
      expect(subs).toHaveLength(0);
    });

    it("returns query data for each subscription", () => {
      const query = {completed: false, ownerId: "user1"};
      addQuerySubscription("socket1", "todos", query, "todos:q1");
      const subs = getQuerySubscriptionsForCollection("todos");
      expect(subs[0].query).toEqual(query);
    });
  });

  describe("clearQueryStore", () => {
    it("removes all subscriptions", () => {
      addQuerySubscription("socket1", "todos", {completed: false}, "todos:q1");
      addQuerySubscription("socket2", "items", {status: "active"}, "items:q1");
      clearQueryStore();
      expect(getQuerySubscriptionsForCollection("todos")).toHaveLength(0);
      expect(getQuerySubscriptionsForCollection("items")).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// registry tests
// ─────────────────────────────────────────────────────────────────────────────

describe("realtimeRegistry", () => {
  const makeEntry = (overrides: Partial<Parameters<typeof registerRealtime>[0]> = {}) => ({
    collectionName: "todos",
    config: {methods: ["create" as const, "update" as const, "delete" as const], roomStrategy: "owner" as const},
    modelName: "Todo",
    options: {} as any,
    routePath: "/todos",
    ...overrides,
  });

  beforeEach(() => {
    clearRealtimeRegistry();
  });

  afterEach(() => {
    clearRealtimeRegistry();
  });

  describe("registerRealtime", () => {
    it("adds an entry to the registry", () => {
      registerRealtime(makeEntry());
      expect(getRealtimeRegistry()).toHaveLength(1);
    });

    it("allows multiple entries", () => {
      registerRealtime(makeEntry({modelName: "Todo", routePath: "/todos"}));
      registerRealtime(makeEntry({modelName: "Item", routePath: "/items", collectionName: "items"}));
      expect(getRealtimeRegistry()).toHaveLength(2);
    });
  });

  describe("getRealtimeRegistry", () => {
    it("returns all registered entries", () => {
      registerRealtime(makeEntry({modelName: "Todo"}));
      registerRealtime(makeEntry({modelName: "Item", routePath: "/items", collectionName: "items"}));
      const registry = getRealtimeRegistry();
      expect(registry).toHaveLength(2);
      expect(registry.map((e) => e.modelName)).toEqual(["Todo", "Item"]);
    });

    it("returns empty array when nothing is registered", () => {
      expect(getRealtimeRegistry()).toHaveLength(0);
    });
  });

  describe("findRegistryEntryByCollection", () => {
    it("finds an entry by collection name", () => {
      registerRealtime(makeEntry({collectionName: "todos"}));
      const entry = findRegistryEntryByCollection("todos");
      expect(entry).toBeDefined();
      expect(entry?.collectionName).toBe("todos");
    });

    it("returns undefined for unknown collection", () => {
      const entry = findRegistryEntryByCollection("nonexistent");
      expect(entry).toBeUndefined();
    });

    it("returns first match when multiple entries exist", () => {
      registerRealtime(makeEntry({collectionName: "todos", modelName: "Todo1"}));
      registerRealtime(makeEntry({collectionName: "todos", modelName: "Todo2"}));
      const entry = findRegistryEntryByCollection("todos");
      expect(entry?.modelName).toBe("Todo1");
    });
  });

  describe("findRegistryEntryByRoutePath", () => {
    it("finds an entry by exact route path with leading slash", () => {
      registerRealtime(makeEntry({routePath: "/todos"}));
      const entry = findRegistryEntryByRoutePath("todos");
      expect(entry).toBeDefined();
      expect(entry?.routePath).toBe("/todos");
    });

    it("finds an entry when collection matches routePath exactly", () => {
      registerRealtime(makeEntry({routePath: "todos"}));
      const entry = findRegistryEntryByRoutePath("todos");
      expect(entry).toBeDefined();
    });

    it("returns undefined for unknown route path", () => {
      registerRealtime(makeEntry({routePath: "/todos"}));
      const entry = findRegistryEntryByRoutePath("items");
      expect(entry).toBeUndefined();
    });
  });

  describe("clearRealtimeRegistry", () => {
    it("removes all entries", () => {
      registerRealtime(makeEntry());
      clearRealtimeRegistry();
      expect(getRealtimeRegistry()).toHaveLength(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RealtimeApp tests
// ─────────────────────────────────────────────────────────────────────────────

describe("RealtimeApp", () => {
  describe("constructor", () => {
    it("creates an instance with empty config", () => {
      const app = new RealtimeApp();
      expect(app).toBeDefined();
    });

    it("creates an instance with provided config", () => {
      const app = new RealtimeApp({debug: true, adapter: "none"});
      expect(app).toBeDefined();
    });
  });

  describe("getIo", () => {
    it("returns null before the server is created", () => {
      const app = new RealtimeApp();
      expect(app.getIo()).toBeNull();
    });
  });

  describe("register", () => {
    it("health endpoint returns status not_started when io is not initialized", async () => {
      const expressApp = express();
      const app = new RealtimeApp();
      app.register(expressApp);

      const supertest = await import("supertest");
      const st = supertest.default(expressApp);
      const res = await st.get("/realtime/health").expect(200);
      expect(res.body.status).toBe("not_started");
      expect(res.body.clients).toBe(0);
    });
  });

  describe("close", () => {
    it("closes gracefully when io is null", async () => {
      const app = new RealtimeApp();
      // Should not throw
      await expect(app.close()).resolves.toBeUndefined();
    });
  });
});
