import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/src/tests";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {FeatureFlag} from "../featureFlagModel";
import {FeatureFlagsApp} from "../featureFlagsApp";
import type {SegmentFunction} from "../types";

const buildApp = (options?: {
  basePath?: string;
  segments?: Record<string, SegmentFunction>;
}): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);

  const plugin = new FeatureFlagsApp(options);
  plugin.register(app);

  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("FeatureFlagsApp", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await FeatureFlag.deleteMany({});
  });

  afterEach(async () => {
    await FeatureFlag.deleteMany({});
  });

  describe("construction", () => {
    it("defaults basePath to /feature-flags and segments to an empty object", async () => {
      app = buildApp();
      adminAgent = await authAsUser(app, "admin");

      const res = await adminAgent.get("/feature-flags/segments").expect(200);
      expect(res.body.data).toEqual([]);
    });

    it("respects a custom basePath", async () => {
      app = buildApp({basePath: "/flags"});
      adminAgent = await authAsUser(app, "admin");

      await adminAgent.get("/flags/segments").expect(200);
      await adminAgent.get("/feature-flags/segments").expect(404);
    });

    it("accepts an empty options object", async () => {
      app = buildApp({});
      adminAgent = await authAsUser(app, "admin");

      const res = await adminAgent.get("/feature-flags/segments").expect(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe("admin CRUD routes", () => {
    beforeEach(async () => {
      app = buildApp();
      adminAgent = await authAsUser(app, "admin");
      notAdminAgent = await authAsUser(app, "notAdmin");
    });

    it("lets admins create, list, read, update, and delete flags", async () => {
      const createRes = await adminAgent
        .post("/feature-flags/flags")
        .send({enabled: true, key: "new-flag", name: "New Flag"})
        .expect(201);

      const flagId: string = createRes.body.data._id;
      expect(createRes.body.data.key).toBe("new-flag");

      const listRes = await adminAgent.get("/feature-flags/flags").expect(200);
      expect(listRes.body.data.length).toBe(1);

      const readRes = await adminAgent.get(`/feature-flags/flags/${flagId}`).expect(200);
      expect(readRes.body.data.key).toBe("new-flag");

      const updateRes = await adminAgent
        .patch(`/feature-flags/flags/${flagId}`)
        .send({rolloutPercentage: 50})
        .expect(200);
      expect(updateRes.body.data.rolloutPercentage).toBe(50);

      await adminAgent.delete(`/feature-flags/flags/${flagId}`).expect(204);
      const finalList = await adminAgent.get("/feature-flags/flags").expect(200);
      expect(finalList.body.data.length).toBe(0);
    });

    it("rejects non-admins from the CRUD routes", async () => {
      // modelRouter responds with 405 Method Not Allowed when permissions fail
      await notAdminAgent.get("/feature-flags/flags").expect(405);
      await notAdminAgent
        .post("/feature-flags/flags")
        .send({key: "nope", name: "Nope"})
        .expect(405);
    });

    it("rejects unauthenticated requests to CRUD routes", async () => {
      const unauth = supertest(app);
      await unauth.get("/feature-flags/flags").expect(401);
    });
  });

  describe("GET /feature-flags/evaluate", () => {
    beforeEach(async () => {
      const segments: Record<string, SegmentFunction> = {
        admins: (user: unknown) => (user as {admin?: boolean}).admin === true,
      };
      app = buildApp({segments});
    });

    it("returns 401 for unauthenticated callers", async () => {
      const unauth = supertest(app);
      await unauth.get("/feature-flags/evaluate").expect(401);
    });

    it("returns all enabled, non-archived flag values for the current user", async () => {
      await FeatureFlag.create({
        enabled: true,
        key: "rolled-out",
        name: "Rolled out",
        rolloutPercentage: 100,
      });
      await FeatureFlag.create({
        enabled: false,
        key: "disabled-flag",
        name: "Disabled",
        rolloutPercentage: 100,
      });
      await FeatureFlag.create({
        archived: true,
        enabled: true,
        key: "archived-flag",
        name: "Archived",
        rolloutPercentage: 100,
      });
      await FeatureFlag.create({
        enabled: true,
        key: "admins-only",
        name: "Admins",
        rolloutPercentage: 0,
        rules: [{enabled: true, segment: "admins"}],
      });

      adminAgent = await authAsUser(app, "admin");

      const res = await adminAgent.get("/feature-flags/evaluate").expect(200);
      expect(res.body.data["rolled-out"]).toBe(true);
      expect(res.body.data["admins-only"]).toBe(true);
      expect(res.body.data["disabled-flag"]).toBeUndefined();
      expect(res.body.data["archived-flag"]).toBeUndefined();
    });

    it("includes an admin's own evaluated flags", async () => {
      await FeatureFlag.create({
        enabled: true,
        key: "user-only",
        name: "User only",
        rolloutPercentage: 0,
        rules: [{enabled: true, field: "admin", operator: "eq", value: true}],
      });

      adminAgent = await authAsUser(app, "admin");
      const res = await adminAgent.get("/feature-flags/evaluate").expect(200);
      expect(res.body.data["user-only"]).toBe(true);

      notAdminAgent = await authAsUser(app, "notAdmin");
      const notAdminRes = await notAdminAgent.get("/feature-flags/evaluate").expect(200);
      // notAdmin isn't admin, rolloutPercentage is 0 → should evaluate false
      expect(notAdminRes.body.data["user-only"]).toBe(false);
    });
  });

  describe("GET /feature-flags/segments", () => {
    beforeEach(async () => {
      app = buildApp({
        segments: {
          admins: () => true,
          "beta-testers": () => false,
        },
      });
    });

    it("returns the registered segment keys for admins", async () => {
      adminAgent = await authAsUser(app, "admin");

      const res = await adminAgent.get("/feature-flags/segments").expect(200);
      expect(res.body.data.sort()).toEqual(["admins", "beta-testers"]);
    });

    it("rejects non-admin users", async () => {
      notAdminAgent = await authAsUser(app, "notAdmin");

      const res = await notAdminAgent.get("/feature-flags/segments").expect(403);
      expect(res.body.title).toInclude("Only admins can view segments");
    });

    it("requires authentication", async () => {
      const unauth = supertest(app);
      await unauth.get("/feature-flags/segments").expect(401);
    });
  });
});
