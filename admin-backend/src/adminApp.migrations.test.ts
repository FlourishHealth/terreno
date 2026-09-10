import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {join} from "node:path";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  BackgroundTask,
  MIGRATION_LOCK_ID,
  MIGRATIONS_COLLECTION,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import type express from "express";
import mongoose from "mongoose";
import type TestAgent from "supertest/lib/agent";

import {AdminApp} from "./adminApp";

const fixturesDir = join(import.meta.dir, "../../api/src/migrations/fixtures/valid");

const buildApp = ({migrationsDir}: {migrationsDir?: string} = {}): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  const admin = new AdminApp({
    basePath: "/admin",
    migrations: migrationsDir ? {dir: migrationsDir} : undefined,
    models: [],
  });
  admin.register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

const waitForTask = (): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, 500));
};

const appliedIds = async (): Promise<string[]> => {
  const docs = await mongoose.connection
    .collection(MIGRATIONS_COLLECTION)
    .find({_id: {$ne: MIGRATION_LOCK_ID}})
    .project({id: 1})
    .toArray();
  return docs.map((doc) => String(doc.id)).sort();
};

describe("AdminApp migrations routes", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  afterEach(async () => {
    await waitForTask();
    await BackgroundTask.deleteMany({});
  });

  describe("when migrations are not configured", () => {
    beforeEach(async () => {
      await setupDb();
      await mongoose.connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
      app = buildApp();
      adminAgent = await authAsUser(app, "admin");
    });

    it("returns 404 for GET /admin/migrations", async () => {
      await adminAgent.get("/admin/migrations").expect(404);
    });

    it("omits enabled migrations from config", async () => {
      const res = await adminAgent.get("/admin/config").expect(200);
      expect(res.body.migrations?.enabled).toBe(false);
    });
  });

  describe("when migrations are configured", () => {
    beforeEach(async () => {
      await setupDb();
      await mongoose.connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
      app = buildApp({migrationsDir: fixturesDir});
      adminAgent = await authAsUser(app, "admin");
      notAdminAgent = await authAsUser(app, "notAdmin");
    });

    it("returns pending status for admins", async () => {
      const res = await adminAgent.get("/admin/migrations").expect(200);
      expect(res.body.pending.map((row: {id: string}) => row.id)).toEqual([
        "20260910120000-alpha",
        "20260910120001-beta",
      ]);
    });

    it("forbids non-admins", async () => {
      await notAdminAgent.get("/admin/migrations").expect(403);
    });

    it("sets migrations.enabled on config", async () => {
      const res = await adminAgent.get("/admin/config").expect(200);
      expect(res.body.migrations.enabled).toBe(true);
    });

    it("dry-run does not persist applied ids", async () => {
      const res = await adminAgent.post("/admin/migrations/run").expect(201);
      expect(res.body.taskId).toBeDefined();
      await waitForTask();
      expect(await appliedIds()).toEqual([]);
      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task?.isDryRun).toBe(true);
      expect(task?.taskType).toBe("migrations:up");
      const polled = await adminAgent.get(`/admin/scripts/tasks/${res.body.taskId}`).expect(200);
      expect(polled.body.task.status).toBe("completed");
    });

    it("applies pending on wet run", async () => {
      const res = await adminAgent.post("/admin/migrations/run?wetRun=true").expect(201);
      await waitForTask();
      expect(await appliedIds()).toEqual(["20260910120000-alpha", "20260910120001-beta"]);
      const task = await BackgroundTask.findById(res.body.taskId);
      expect(task?.isDryRun).toBe(false);
    });

    it("returns 403 for production wet apply without ALLOW_MIGRATIONS", async () => {
      const previousNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      Reflect.deleteProperty(process.env, "ALLOW_MIGRATIONS");
      try {
        await adminAgent.post("/admin/migrations/run?wetRun=true").expect(403);
        expect(await appliedIds()).toEqual([]);
      } finally {
        process.env.NODE_ENV = previousNodeEnv;
      }
    });
  });
});
