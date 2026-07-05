// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import {model, Schema} from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import type {ModelRouterOptions} from "../api";
import {addAuthRoutes, setupAuth} from "../auth";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {authAsUser, getBaseServer, setupDb, UserModel} from "../tests";
import {SyncCounter, SyncKey} from "./models";
import {clearSyncRegistry, registerSync} from "./registry";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";

interface RouteStuff extends IsDeleted {
  _id: string;
  name: string;
  ownerId: string;
  created: Date;
  _syncSeq?: number;
}

const routeStuffSchema = new Schema<RouteStuff>({
  name: {description: "The name of the item", required: true, type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
routeStuffSchema.plugin(isDeletedPlugin);
routeStuffSchema.plugin(createdUpdatedPlugin);
routeStuffSchema.plugin(syncPlugin);
const RouteStuffModel = model<RouteStuff>("SyncRouteStuff", routeStuffSchema);

interface RouteProject extends IsDeleted {
  _id: string;
  title: string;
  orgId: string;
  _syncSeq?: number;
}

const routeProjectSchema = new Schema<RouteProject>({
  orgId: {description: "The organization this project belongs to", type: String},
  title: {description: "The project title", required: true, type: String},
});
routeProjectSchema.plugin(isDeletedPlugin);
routeProjectSchema.plugin(createdUpdatedPlugin);
routeProjectSchema.plugin(syncPlugin);
const RouteProjectModel = model<RouteProject>("SyncRouteProject", routeProjectSchema);

const authedOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
} as unknown as ModelRouterOptions<any>;

const adminOnlyOptions = {
  permissions: {
    create: [Permissions.IsAdmin],
    delete: [Permissions.IsAdmin],
    list: [Permissions.IsAdmin],
    read: [Permissions.IsAdmin],
    update: [Permissions.IsAdmin],
  },
} as unknown as ModelRouterOptions<any>;

describe("sync routes", () => {
  let app: express.Application;
  let server: TestAgent;
  let agent: TestAgent;
  let adminAgent: TestAgent;
  let notAdminId: string;

  beforeEach(async () => {
    const [admin, notAdmin] = await setupDb();
    notAdminId = String(notAdmin._id);
    void admin;

    clearSyncRegistry();
    registerSync({
      config: {scope: {type: "owner"}},
      model: RouteStuffModel as any,
      options: authedOptions,
      routePath: "/routeStuff",
    });
    registerSync({
      config: {scope: {field: "orgId", type: "tenant"}},
      model: RouteProjectModel as any,
      options: authedOptions,
      routePath: "/routeProjects",
    });

    await Promise.all([
      RouteStuffModel.collection.deleteMany({}),
      RouteProjectModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncKey.deleteMany({}),
    ]);

    app = getBaseServer();
    setupAuth(app as any, UserModel as any);
    addAuthRoutes(app as any, UserModel as any);
    new SyncApp({
      getUserScopes: () => ["org1"],
    }).register(app);

    server = supertest(app);
    agent = await authAsUser(app, "notAdmin");
    adminAgent = await authAsUser(app, "admin");
  });

  describe("GET /sync/snapshot", () => {
    it("requires authentication", async () => {
      await server.get("/sync/snapshot?collection=routeStuff").expect(401);
    });

    it("requires a collection parameter", async () => {
      const res = await agent.get("/sync/snapshot").expect(400);
      expect(res.body.title).toMatch(/collection/);
    });

    it("404s for unknown collections", async () => {
      await agent.get("/sync/snapshot?collection=nope").expect(404);
    });

    it("400s for invalid cursor and limit", async () => {
      await agent.get("/sync/snapshot?collection=routeStuff&cursor=abc").expect(400);
      await agent.get("/sync/snapshot?collection=routeStuff&limit=-2").expect(400);
    });

    it("enforces the model's list permissions", async () => {
      clearSyncRegistry();
      registerSync({
        config: {scope: {type: "owner"}},
        model: RouteStuffModel as any,
        options: adminOnlyOptions,
        routePath: "/routeStuff",
      });
      await agent.get("/sync/snapshot?collection=routeStuff").expect(403);
      await adminAgent.get("/sync/snapshot?collection=routeStuff").expect(200);
    });

    it("returns a full owner-scoped snapshot at cursor 0", async () => {
      await RouteStuffModel.create({name: "mine 1", ownerId: notAdminId});
      await RouteStuffModel.create({name: "mine 2", ownerId: notAdminId});
      await RouteStuffModel.create({name: "theirs", ownerId: "someoneElse"});

      const res = await agent.get("/sync/snapshot?collection=routeStuff").expect(200);
      expect(res.body.entities).toHaveLength(2);
      expect(res.body.entities.map((e: any) => e.data.name)).toEqual(["mine 1", "mine 2"]);
      expect(res.body.entities.map((e: any) => e.seq)).toEqual([1, 2]);
      expect(res.body.cursor).toBe(2);
      expect(res.body.hasMore).toBe(false);
    });

    it("returns incremental changes and tombstones past a cursor", async () => {
      const doc1 = await RouteStuffModel.create({name: "first", ownerId: notAdminId});
      const doc2 = await RouteStuffModel.create({name: "second", ownerId: notAdminId});

      const initial = await agent.get("/sync/snapshot?collection=routeStuff").expect(200);
      const cursor = initial.body.cursor;

      doc1.name = "first updated";
      await doc1.save();
      doc2.deleted = true;
      await doc2.save();

      const res = await agent
        .get(`/sync/snapshot?collection=routeStuff&cursor=${cursor}`)
        .expect(200);
      expect(res.body.entities).toHaveLength(2);
      const updated = res.body.entities.find((e: any) => e.id === String(doc1._id));
      const tombstone = res.body.entities.find((e: any) => e.id === String(doc2._id));
      expect(updated.data.name).toBe("first updated");
      expect(updated.deleted).toBe(false);
      expect(tombstone.deleted).toBe(true);
      expect(tombstone.seq).toBeGreaterThan(cursor);
    });

    it("paginates by seq with hasMore and a resumable cursor", async () => {
      for (let i = 1; i <= 5; i++) {
        await RouteStuffModel.create({name: `item ${i}`, ownerId: notAdminId});
      }
      const page1 = await agent.get("/sync/snapshot?collection=routeStuff&limit=2").expect(200);
      expect(page1.body.entities).toHaveLength(2);
      expect(page1.body.hasMore).toBe(true);

      const page2 = await agent
        .get(`/sync/snapshot?collection=routeStuff&limit=2&cursor=${page1.body.cursor}`)
        .expect(200);
      expect(page2.body.entities).toHaveLength(2);
      expect(page2.body.hasMore).toBe(true);

      const page3 = await agent
        .get(`/sync/snapshot?collection=routeStuff&limit=2&cursor=${page2.body.cursor}`)
        .expect(200);
      expect(page3.body.entities).toHaveLength(1);
      expect(page3.body.hasMore).toBe(false);

      const names = [...page1.body.entities, ...page2.body.entities, ...page3.body.entities].map(
        (e: any) => e.data.name
      );
      expect(names).toEqual(["item 1", "item 2", "item 3", "item 4", "item 5"]);
    });

    it("delivers legacy docs without _syncSeq in the first page only", async () => {
      // Bypass mongoose entirely to simulate documents created before sync was enabled.
      await RouteStuffModel.collection.insertMany([
        {deleted: false, name: "legacy", ownerId: notAdminId},
      ]);
      await RouteStuffModel.create({name: "modern", ownerId: notAdminId});

      const first = await agent.get("/sync/snapshot?collection=routeStuff").expect(200);
      expect(first.body.entities.map((e: any) => e.data.name)).toEqual(["legacy", "modern"]);
      expect(first.body.entities[0].seq).toBe(0);

      const incremental = await agent
        .get(`/sync/snapshot?collection=routeStuff&cursor=${first.body.cursor}`)
        .expect(200);
      expect(incremental.body.entities).toHaveLength(0);
    });

    it("scopes tenant collections to the user's tenants", async () => {
      await RouteProjectModel.create({orgId: "org1", title: "visible"});
      await RouteProjectModel.create({orgId: "org2", title: "hidden"});

      const res = await agent.get("/sync/snapshot?collection=routeProjects").expect(200);
      expect(res.body.entities).toHaveLength(1);
      expect(res.body.entities[0].data.title).toBe("visible");
    });

    it("500s for tenant collections when no getUserScopes resolver is configured", async () => {
      const bareApp = getBaseServer();
      setupAuth(bareApp as any, UserModel as any);
      addAuthRoutes(bareApp as any, UserModel as any);
      new SyncApp().register(bareApp);
      const bareAgent = await authAsUser(bareApp, "notAdmin");
      await bareAgent.get("/sync/snapshot?collection=routeProjects").expect(500);
    });

    it("uses the sync responseHandler to serialize entities", async () => {
      clearSyncRegistry();
      registerSync({
        config: {
          responseHandler: (doc) => ({redactedName: `x-${(doc as any).name}`}),
          scope: {type: "owner"},
        },
        model: RouteStuffModel as any,
        options: authedOptions,
        routePath: "/routeStuff",
      });
      await RouteStuffModel.create({name: "secret", ownerId: notAdminId});
      const res = await agent.get("/sync/snapshot?collection=routeStuff").expect(200);
      expect(res.body.entities[0].data).toEqual({redactedName: "x-secret"});
    });
  });

  describe("GET /sync/key", () => {
    it("requires authentication", async () => {
      await server.get("/sync/key").expect(401);
    });

    it("returns stable 32-byte key material per user", async () => {
      const first = await agent.get("/sync/key").expect(200);
      const second = await agent.get("/sync/key").expect(200);
      expect(first.body.keyMaterial).toBe(second.body.keyMaterial);
      expect(Buffer.from(first.body.keyMaterial, "base64")).toHaveLength(32);
    });

    it("gives different users different material", async () => {
      const notAdminKey = await agent.get("/sync/key").expect(200);
      const adminKey = await adminAgent.get("/sync/key").expect(200);
      expect(notAdminKey.body.keyMaterial).not.toBe(adminKey.body.keyMaterial);
    });
  });
});
