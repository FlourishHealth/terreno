// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeAll, beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import {model, Schema} from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import type {ModelRouterOptions} from "../api";
import {addAuthRoutes, setupAuth, type User} from "../auth";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {DEFAULT_IGNORED_COLLECTIONS} from "../realtime/changeStreamWatcher";
import {authAsUser, getBaseServer, setupDb, UserModel} from "../tests";
import {SyncCounter, SyncKey, SyncMutation} from "./models";
import {clearSyncRegistry, registerSync, type SyncRegistryEntry} from "./registry";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";

/**
 * Phase C route/scope tests: per-stream snapshot cursors (C2), legacy `_id` pagination
 * (C3), write-scope enforcement + snapshot read parity (C6), and the C8 minors.
 * C1 (frontier) and C4 (scope-move markers) have their own dedicated files.
 */

interface PhaseCTodo extends IsDeleted {
  _id: string;
  title: string;
  ownerId: string;
  _syncSeq?: number;
}

const phaseCTodoSchema = new Schema<PhaseCTodo>({
  ownerId: {description: "The owner", type: String},
  title: {description: "The title", required: true, type: String},
});
phaseCTodoSchema.plugin(isDeletedPlugin);
phaseCTodoSchema.plugin(createdUpdatedPlugin);
phaseCTodoSchema.plugin(syncPlugin);
const PhaseCTodoModel = model<PhaseCTodo>("SyncPhaseCTodo", phaseCTodoSchema);

interface PhaseCProject extends IsDeleted {
  _id: string;
  title: string;
  orgId: string;
  _syncSeq?: number;
}

const phaseCProjectSchema = new Schema<PhaseCProject>({
  orgId: {description: "The organization", type: String},
  title: {description: "The title", required: true, type: String},
});
phaseCProjectSchema.plugin(isDeletedPlugin);
phaseCProjectSchema.plugin(createdUpdatedPlugin);
phaseCProjectSchema.plugin(syncPlugin);
const PhaseCProjectModel = model<PhaseCProject>("SyncPhaseCProject", phaseCProjectSchema);

const authedOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
} as unknown as ModelRouterOptions<any>;

// Per-user tenant membership, mutable so join tests can extend it.
const userOrgs = new Map<string, string[]>();

beforeAll(async () => {
  await Promise.all([
    SyncCounter.ensureIndexes(),
    SyncKey.ensureIndexes(),
    SyncMutation.ensureIndexes(),
  ]);
});

describe("Phase C sync routes", () => {
  let app: express.Application;
  let server: TestAgent;
  let agent: TestAgent;
  let notAdminId: string;

  const ownerStream = (): string => `phaseCTodos|owner:${notAdminId}`;
  const enc = encodeURIComponent;

  beforeEach(async () => {
    const [, notAdmin] = await setupDb();
    notAdminId = String(notAdmin._id);
    userOrgs.clear();
    userOrgs.set(notAdminId, ["org1", "org2"]);

    clearSyncRegistry();
    registerSync({
      config: {scope: {type: "owner"}},
      model: PhaseCTodoModel as any,
      options: authedOptions,
      routePath: "/phaseCTodos",
    });
    registerSync({
      config: {scope: {field: "orgId", type: "tenant"}},
      model: PhaseCProjectModel as any,
      options: authedOptions,
      routePath: "/phaseCProjects",
    });

    await Promise.all([
      PhaseCTodoModel.collection.deleteMany({}),
      PhaseCProjectModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncKey.deleteMany({}),
      SyncMutation.deleteMany({}),
    ]);

    app = getBaseServer();
    setupAuth(app as any, UserModel as any);
    addAuthRoutes(app as any, UserModel as any);
    new SyncApp({
      getUserScopes: (user: User, entry: SyncRegistryEntry) => {
        // Custom-scoped entries (used by the $or snapshotFilter test) resolve their
        // membership to the caller's own id (the custom scope value = ownerId).
        if (typeof entry.config.scope === "function") {
          return [String(user.id)];
        }
        return userOrgs.get(String(user.id)) ?? [];
      },
    }).register(app);

    server = supertest(app);
    agent = await authAsUser(app, "notAdmin");
  });

  // ── C2: per-stream cursors + /sync/streams ────────────────────────────────
  describe("C2 — per-stream cursors and /sync/streams", () => {
    it("GET /sync/streams returns owner + tenant streams reflecting memberships", async () => {
      const res = await agent.get("/sync/streams").expect(200);
      const streams: string[] = res.body.streams.map((s: any) => s.stream);
      expect(streams).toContain(ownerStream());
      expect(streams).toContain("phaseCProjects|tenant:org1");
      expect(streams).toContain("phaseCProjects|tenant:org2");
      // Every entry carries its collection tag.
      for (const s of res.body.streams) {
        expect(typeof s.collection).toBe("string");
      }
    });

    it("requires authentication for /sync/streams", async () => {
      await server.get("/sync/streams").expect(401);
    });

    it("catches two tenant streams to independent cursors (the flattened-cursor bug does NOT reproduce)", async () => {
      // org1 has a high seq (many writes), org2 a low seq. Under the OLD flattened cursor,
      // catching org1 to its head would strand org2 behind org1's cursor. Per-stream, each
      // catches independently.
      for (let i = 1; i <= 6; i++) {
        await PhaseCProjectModel.create({orgId: "org1", title: `org1-${i}`});
      }
      await PhaseCProjectModel.create({orgId: "org2", title: "org2-only"});

      const org1 = await agent
        .get(`/sync/snapshot?stream=${enc("phaseCProjects|tenant:org1")}`)
        .expect(200);
      expect(org1.body.entities).toHaveLength(6);
      expect(org1.body.cursor).toBe(6);

      // org2's stream has its OWN counter — its single doc is seq 1, fully caught up
      // regardless of org1's cursor being at 6.
      const org2 = await agent
        .get(`/sync/snapshot?stream=${enc("phaseCProjects|tenant:org2")}`)
        .expect(200);
      expect(org2.body.entities).toHaveLength(1);
      expect(org2.body.entities[0].data.title).toBe("org2-only");
      expect(org2.body.entities[0].seq).toBe(1);
      expect(org2.body.cursor).toBe(1);
      expect(org2.body.hasMore).toBe(false);
    });

    it("reflects a tenant join in /sync/streams (new stream becomes available)", async () => {
      let res = await agent.get("/sync/streams").expect(200);
      expect(res.body.streams.map((s: any) => s.stream)).not.toContain(
        "phaseCProjects|tenant:org3"
      );
      // Join org3.
      userOrgs.set(notAdminId, ["org1", "org2", "org3"]);
      res = await agent.get("/sync/streams").expect(200);
      expect(res.body.streams.map((s: any) => s.stream)).toContain("phaseCProjects|tenant:org3");
      // And the newly-joined stream is now snapshottable.
      await PhaseCProjectModel.create({orgId: "org3", title: "joined"});
      const snap = await agent
        .get(`/sync/snapshot?stream=${enc("phaseCProjects|tenant:org3")}`)
        .expect(200);
      expect(snap.body.entities[0].data.title).toBe("joined");
    });

    it("403s snapshotting a tenant stream the user does not belong to", async () => {
      await agent.get(`/sync/snapshot?stream=${enc("phaseCProjects|tenant:orgOther")}`).expect(403);
    });
  });

  // ── C3: legacy _id pagination ──────────────────────────────────────────────
  describe("C3 — legacy _id-paged stratum", () => {
    it("drains a large legacy stratum via legacyCursor then continues by seq (no infinite loop)", async () => {
      // 1201 legacy docs (no _syncSeq) via raw insert; limit 500. The old first-page-only
      // logic looped forever; the _id stratum drains deterministically.
      const legacy = Array.from({length: 1201}, (_v, i) => ({
        deleted: false,
        name: undefined,
        ownerId: notAdminId,
        title: `legacy-${String(i).padStart(4, "0")}`,
      }));
      await PhaseCTodoModel.collection.insertMany(legacy as any);
      // A couple of modern (stamped) docs after the legacy stratum.
      await PhaseCTodoModel.create({ownerId: notAdminId, title: "modern-1"});
      await PhaseCTodoModel.create({ownerId: notAdminId, title: "modern-2"});

      const seen = new Set<string>();
      let cursor = 0;
      let legacyCursor: string | undefined;
      let pages = 0;
      const limit = 500;
      // Simulate the client loop: echo legacyCursor until absent, then page by seq.
      for (;;) {
        pages += 1;
        expect(pages).toBeLessThan(20); // termination guard
        const qs = new URLSearchParams({limit: String(limit), stream: ownerStream()});
        if (cursor > 0) {
          qs.set("cursor", String(cursor));
        }
        if (legacyCursor !== undefined) {
          qs.set("legacyCursor", legacyCursor);
        }
        const res = await agent.get(`/sync/snapshot?${qs.toString()}`).expect(200);
        for (const e of res.body.entities) {
          seen.add(e.id);
        }
        if (res.body.legacyCursor !== undefined) {
          legacyCursor = res.body.legacyCursor;
          continue;
        }
        // Legacy stratum drained; now paging by seq.
        legacyCursor = undefined;
        if (!res.body.hasMore) {
          break;
        }
        cursor = res.body.cursor;
      }
      // All 1201 legacy + 2 modern docs delivered, none missed.
      expect(seen.size).toBe(1203);
    }, 30_000);

    it("delivers a small legacy stratum then the seq stratum in order", async () => {
      await PhaseCTodoModel.collection.insertMany([
        {deleted: false, ownerId: notAdminId, title: "legacy-a"},
        {deleted: false, ownerId: notAdminId, title: "legacy-b"},
      ] as any);
      await PhaseCTodoModel.create({ownerId: notAdminId, title: "stamped"});

      const page1 = await agent
        .get(`/sync/snapshot?stream=${enc(ownerStream())}&limit=10`)
        .expect(200);
      // First page is the legacy stratum (seq 0), with a legacyCursor.
      expect(page1.body.entities.every((e: any) => e.seq === 0)).toBe(true);
      expect(page1.body.legacyCursor).toBeDefined();
      expect(page1.body.hasMore).toBe(true);

      const page2 = await agent
        .get(
          `/sync/snapshot?stream=${enc(ownerStream())}&limit=10&legacyCursor=${enc(
            page1.body.legacyCursor
          )}`
        )
        .expect(200);
      // Legacy stratum exhausted; falls through to seq paging (no legacyCursor).
      expect(page2.body.legacyCursor).toBeUndefined();
      const stamped = page2.body.entities.find((e: any) => e.data?.title === "stamped");
      expect(stamped?.seq).toBe(1);
    });
  });

  // ── C6: write-scope enforcement + snapshot read parity ─────────────────────
  describe("C6 — write-scope enforcement + read parity", () => {
    const create = (mutationId: string, data: Record<string, unknown>) => ({
      collection: "phaseCTodos",
      data,
      mutationId,
      operation: "create",
    });

    it("nacks unauthorized a create with a foreign ownerId (owner scope)", async () => {
      const res = await agent
        .post("/sync/mutate")
        .send(create("c6-owner-foreign", {ownerId: "someoneElse", title: "x"}))
        .expect(403);
      expect(res.body.nack.code).toBe("unauthorized");
      expect(await PhaseCTodoModel.countDocuments({title: "x"})).toBe(0);
    });

    it("allows a create with the caller's own ownerId", async () => {
      const res = await agent
        .post("/sync/mutate")
        .send(create("c6-owner-self", {ownerId: notAdminId, title: "mine"}))
        .expect(200);
      expect(res.body.ack.mutationId).toBe("c6-owner-self");
    });

    it("nacks unauthorized a tenant create for a non-member org", async () => {
      const res = await agent
        .post("/sync/mutate")
        .send({
          collection: "phaseCProjects",
          data: {orgId: "orgNotMine", title: "sneaky"},
          mutationId: "c6-tenant-foreign",
          operation: "create",
        })
        .expect(403);
      expect(res.body.nack.code).toBe("unauthorized");
    });

    it("allows a tenant create for a member org", async () => {
      await agent
        .post("/sync/mutate")
        .send({
          collection: "phaseCProjects",
          data: {orgId: "org1", title: "ours"},
          mutationId: "c6-tenant-member",
          operation: "create",
        })
        .expect(200);
    });

    it("snapshot omits per-doc read-denied docs but still advances the cursor past them", async () => {
      // A read permission that denies odd-titled docs.
      clearSyncRegistry();
      registerSync({
        config: {scope: {type: "owner"}},
        model: PhaseCTodoModel as any,
        options: {
          ...authedOptions,
          permissions: {
            ...(authedOptions as any).permissions,
            read: [
              (_method: any, _user: any, doc?: any) => {
                if (!doc) {
                  return true;
                }
                return !String(doc.title).endsWith("-secret");
              },
            ],
          },
        } as unknown as ModelRouterOptions<any>,
        routePath: "/phaseCTodos",
      });

      await PhaseCTodoModel.create({ownerId: notAdminId, title: "visible-1"});
      await PhaseCTodoModel.create({ownerId: notAdminId, title: "hidden-secret"});
      await PhaseCTodoModel.create({ownerId: notAdminId, title: "visible-2"});

      const res = await agent.get(`/sync/snapshot?stream=${enc(ownerStream())}`).expect(200);
      const titles = res.body.entities.map((e: any) => e.data.title);
      expect(titles).toEqual(["visible-1", "visible-2"]);
      // The cursor advanced past the denied doc (seq 3), so it is never re-fetched.
      expect(res.body.cursor).toBe(3);
    });

    it("composes a custom-scope $or snapshotFilter with $and (does not clobber deleted/seq)", async () => {
      // A custom scope whose snapshotFilter is an $or; the route must $and it with the
      // deleted/seq clauses so tombstones and seq bounds still apply.
      clearSyncRegistry();
      registerSync({
        config: {
          scope: (doc: Record<string, unknown>) => String(doc.ownerId),
          snapshotFilter: () => ({$or: [{ownerId: notAdminId}, {ownerId: "shared"}]}),
        },
        model: PhaseCTodoModel as any,
        options: authedOptions,
        routePath: "/phaseCTodos",
      });
      const mine = await PhaseCTodoModel.create({ownerId: notAdminId, title: "mine"});
      await PhaseCTodoModel.create({ownerId: "shared", title: "shared"});
      await PhaseCTodoModel.create({ownerId: "other", title: "other"});
      // Soft-delete one so the tombstone path is exercised under the $or filter.
      mine.deleted = true;
      await mine.save();

      const customStream = `phaseCTodos|custom:${notAdminId}`;
      const res = await agent.get(`/sync/snapshot?stream=${enc(customStream)}`).expect(200);
      const byTitle = new Map(res.body.entities.map((e: any) => [e.id, e]));
      // "other" is excluded by the $or filter; "mine" appears as a tombstone (data null).
      const titles = res.body.entities
        .filter((e: any) => !e.deleted)
        .map((e: any) => e.data.title)
        .sort();
      expect(titles).toEqual(["shared"]);
      const tombstone = byTitle.get(String(mine._id)) as any;
      expect(tombstone?.deleted).toBe(true);
      expect(tombstone?.data).toBeNull();
    });

    it("throws on a query updateOne with upsert:true (m8)", async () => {
      const doc = await PhaseCTodoModel.create({ownerId: notAdminId, title: "u"});
      // upsert:true on a synced model must throw at the plugin layer.
      let threw = false;
      try {
        await PhaseCTodoModel.updateOne({_id: doc._id}, {$set: {title: "u2"}}, {upsert: true});
      } catch (error) {
        threw = true;
        expect(String(error)).toMatch(/upsert/i);
      }
      expect(threw).toBe(true);
    });

    it("nacks validation an update with baseVersion omitted (C8)", async () => {
      const doc = await PhaseCTodoModel.create({ownerId: notAdminId, title: "needs base"});
      const res = await agent
        .post("/sync/mutate")
        .send({
          collection: "phaseCTodos",
          data: {title: "changed"},
          id: String(doc._id),
          mutationId: "c8-no-base",
          operation: "update",
          // baseVersion intentionally omitted
        })
        .expect(422);
      expect(res.body.nack.code).toBe("validation");
      expect(res.body.nack.message).toMatch(/baseVersion/i);
    });
  });

  // ── C8: minors ─────────────────────────────────────────────────────────────
  describe("C8 — minors", () => {
    it("returns an idempotent ack when deleting an already-deleted doc (not 404/validation)", async () => {
      const doc = await PhaseCTodoModel.create({ownerId: notAdminId, title: "to delete"});
      const first = await agent
        .post("/sync/mutate")
        .send({
          collection: "phaseCTodos",
          id: String(doc._id),
          mutationId: "c8-del-1",
          operation: "delete",
        })
        .expect(200);
      expect(first.body.ack).toBeDefined();

      // Second delete of the (now soft-deleted) doc, distinct mutationId: idempotent ack.
      const second = await agent
        .post("/sync/mutate")
        .send({
          collection: "phaseCTodos",
          id: String(doc._id),
          mutationId: "c8-del-2",
          operation: "delete",
        })
        .expect(200);
      expect(second.body.ack).toBeDefined();
      expect(second.body.ack.id).toBe(String(doc._id));
    });

    it("passes 'read' (not 'list') to the modelRouter responseHandler for single-entity sync serialization", async () => {
      const seenMethods: string[] = [];
      clearSyncRegistry();
      registerSync({
        config: {scope: {type: "owner"}},
        model: PhaseCTodoModel as any,
        options: {
          ...authedOptions,
          responseHandler: (value: any, method: string) => {
            seenMethods.push(method);
            return method === "read" ? {shape: "read", title: value.title} : value;
          },
        } as unknown as ModelRouterOptions<any>,
        routePath: "/phaseCTodos",
      });
      await PhaseCTodoModel.create({ownerId: notAdminId, title: "rh"});
      const res = await agent.get(`/sync/snapshot?stream=${enc(ownerStream())}`).expect(200);
      expect(seenMethods).toContain("read");
      expect(seenMethods).not.toContain("list");
      expect(res.body.entities[0].data).toEqual({shape: "read", title: "rh"});
    });

    it("rejects a duplicate collectionTag at registration", () => {
      clearSyncRegistry();
      registerSync({
        config: {scope: {type: "owner"}},
        model: PhaseCTodoModel as any,
        options: authedOptions,
        routePath: "/dupTag",
      });
      // A different model under the SAME tag must be rejected (the tag, not the model,
      // is the duplicate). PhaseCProjectModel's valid tenant scope passes the field check
      // so registration reaches the duplicate-tag guard.
      expect(() =>
        registerSync({
          config: {scope: {field: "orgId", type: "tenant"}},
          model: PhaseCProjectModel as any,
          options: authedOptions,
          routePath: "/dupTag",
        })
      ).toThrow(/already registered/i);
    });
  });

  // ── C7: change-stream watcher ignores sync bookkeeping collections ──────────
  describe("C7 — watcher ignores sync bookkeeping collections", () => {
    it("adds the sync bookkeeping collections to the watcher's default ignore list", () => {
      // The watcher's change-stream pipeline excludes these collections, so their own
      // internal writes (counter $inc, ledger rows, scope-move markers, key material)
      // never drive fan-out or get reprocessed as deltas.
      for (const coll of ["synccounters", "syncmutations", "syncscopemoves", "synckeys"]) {
        expect(DEFAULT_IGNORED_COLLECTIONS).toContain(coll);
      }
    });
  });
});
