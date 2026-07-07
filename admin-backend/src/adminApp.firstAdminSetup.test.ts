import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import type {AdminAuditEvent, AdminOptions} from "./adminApp";
import {AdminApp} from "./adminApp";

const buildApp = (adminOverrides?: Partial<AdminOptions>): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);

  const admin = new AdminApp({
    basePath: "/admin",
    models: [],
    ...adminOverrides,
  });
  admin.register(app);

  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);

  return app;
};

/** Demotes every seeded admin so the DB simulates a fresh deploy with zero admins. */
const clearAllAdmins = async (): Promise<void> => {
  await UserModel.updateMany({admin: true}, {$set: {admin: false}});
};

describe("AdminApp first-admin setup flow", () => {
  const OLD_ENV = process.env.ADMIN_SETUP_DISABLED;

  afterEach(() => {
    if (OLD_ENV === undefined) {
      delete process.env.ADMIN_SETUP_DISABLED;
    } else {
      process.env.ADMIN_SETUP_DISABLED = OLD_ENV;
    }
  });

  describe("when firstAdminSetup is not configured", () => {
    let app: express.Application;

    beforeEach(async () => {
      await setupDb();
      app = buildApp();
    });

    it("does not register setup-status", async () => {
      await supertest(app).get("/admin/setup-status").expect(404);
    });

    it("does not register setup-claim", async () => {
      await supertest(app).post("/admin/setup-claim").expect(404);
    });
  });

  describe("GET /admin/setup-status", () => {
    let app: express.Application;

    beforeEach(async () => {
      await setupDb();
      app = buildApp({firstAdminSetup: {userModel: UserModel as unknown as UserModelType}});
    });

    it("returns needsSetup: true when no admin user exists", async () => {
      await clearAllAdmins();

      const res = await supertest(app).get("/admin/setup-status").expect(200);

      expect(res.body.needsSetup).toBe(true);
    });

    it("returns needsSetup: false when an admin user already exists", async () => {
      const res = await supertest(app).get("/admin/setup-status").expect(200);

      expect(res.body.needsSetup).toBe(false);
    });

    it("returns needsSetup: false when disabled via ADMIN_SETUP_DISABLED", async () => {
      await clearAllAdmins();
      process.env.ADMIN_SETUP_DISABLED = "true";

      const res = await supertest(app).get("/admin/setup-status").expect(200);

      expect(res.body.needsSetup).toBe(false);
    });

    it("does not require authentication", async () => {
      await clearAllAdmins();

      const res = await supertest(app).get("/admin/setup-status").expect(200);

      expect(res.body.needsSetup).toBe(true);
    });
  });

  describe("POST /admin/setup-claim", () => {
    let app: express.Application;
    let notAdminAgent: TestAgent;
    let adminAgent: TestAgent;

    beforeEach(async () => {
      await setupDb();
      app = buildApp({firstAdminSetup: {userModel: UserModel as unknown as UserModelType}});
      notAdminAgent = await authAsUser(app, "notAdmin");
      adminAgent = await authAsUser(app, "admin");
    });

    it("returns 401 when unauthenticated", async () => {
      await clearAllAdmins();

      await supertest(app).post("/admin/setup-claim").expect(401);
    });

    it("promotes the signed-in user to admin when no admin exists yet", async () => {
      await clearAllAdmins();

      const res = await notAdminAgent.post("/admin/setup-claim").expect(200);

      expect(res.body.admin).toBe(true);
      const updated = await UserModel.findOne({email: "notAdmin@example.com"});
      expect(updated?.admin).toBe(true);
    });

    it("makes setup-status report needsSetup: false after claiming", async () => {
      await clearAllAdmins();
      await notAdminAgent.post("/admin/setup-claim").expect(200);

      const res = await supertest(app).get("/admin/setup-status").expect(200);
      expect(res.body.needsSetup).toBe(false);
    });

    it("returns 403 when an admin user already exists", async () => {
      const res = await notAdminAgent.post("/admin/setup-claim").expect(403);

      expect(res.body.title).toInclude("An admin user already exists");
      const unchanged = await UserModel.findOne({email: "notAdmin@example.com"});
      expect(unchanged?.admin).toBe(false);
    });

    it("returns 403 for an already-admin caller once another admin exists", async () => {
      // setupDb seeds two admins (admin, adminOther), so the guard rejects even an
      // already-admin caller since the "no admin exists yet" precondition is false.
      const res = await adminAgent.post("/admin/setup-claim").expect(403);
      expect(res.body.title).toInclude("An admin user already exists");
    });

    it("returns 403 when disabled via ADMIN_SETUP_DISABLED even with zero admins", async () => {
      await clearAllAdmins();
      process.env.ADMIN_SETUP_DISABLED = "true";

      const res = await notAdminAgent.post("/admin/setup-claim").expect(403);

      expect(res.body.title).toInclude("An admin user already exists");
      const unchanged = await UserModel.findOne({email: "notAdmin@example.com"});
      expect(unchanged?.admin).toBe(false);
    });
  });

  describe("POST /admin/setup-claim onAdminAudit", () => {
    let app: express.Application;
    let notAdminAgent: TestAgent;
    const auditEvents: AdminAuditEvent[] = [];

    beforeEach(async () => {
      await setupDb();
      auditEvents.length = 0;
      app = buildApp({
        firstAdminSetup: {userModel: UserModel as unknown as UserModelType},
        onAdminAudit: async (event): Promise<void> => {
          auditEvents.push(event);
        },
      });
      notAdminAgent = await authAsUser(app, "notAdmin");
    });

    it("invokes onAdminAudit with verb updated after claiming", async () => {
      await clearAllAdmins();
      const notAdmin = await UserModel.findOne({email: "notAdmin@example.com"});

      await notAdminAgent.post("/admin/setup-claim").expect(200);

      expect(auditEvents).toHaveLength(1);
      const [event] = auditEvents;
      expect(event.verb).toBe("updated");
      expect(event.modelName).toBe("User");
      expect(event.recordId).toBe(String(notAdmin?._id));
      expect(event.actorId).toBe(String(notAdmin?._id));
    });

    it("does not invoke onAdminAudit when the claim is rejected", async () => {
      // An admin already exists (setupDb default), so the claim is rejected before
      // any mutation or audit event.
      await notAdminAgent.post("/admin/setup-claim").expect(403);

      expect(auditEvents).toHaveLength(0);
    });

    it("still returns 200 when onAdminAudit throws (audit is best-effort)", async () => {
      await clearAllAdmins();
      const throwingApp = buildApp({
        firstAdminSetup: {userModel: UserModel as unknown as UserModelType},
        onAdminAudit: async (): Promise<void> => {
          throw new Error("audit sink failure");
        },
      });
      const agent = await authAsUser(throwingApp, "notAdmin");

      const res = await agent.post("/admin/setup-claim").expect(200);

      expect(res.body.admin).toBe(true);
      const updated = await UserModel.findOne({email: "notAdmin@example.com"});
      expect(updated?.admin).toBe(true);
    });
  });
});
