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
import {DateTime} from "luxon";
import type TestAgent from "supertest/lib/agent";
import {AnnouncementsApp} from "../announcementsApp";
import {Announcement} from "../models/announcement";
import {AnnouncementAcknowledgement} from "../models/announcementAcknowledgement";

const buildApp = (options?: {
  acknowledgementMode?: "admin" | "always" | "never";
  basePath?: string;
  matchAudience?: (user: unknown, announcement: unknown) => boolean;
}): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);

  const plugin = new AnnouncementsApp(options);
  plugin.register(app);

  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("AnnouncementsApp", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let userAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await Announcement.deleteMany({});
    await AnnouncementAcknowledgement.deleteMany({});
    app = buildApp();
    adminAgent = await authAsUser(app, "admin");
    userAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await Announcement.deleteMany({});
    await AnnouncementAcknowledgement.deleteMany({});
  });

  it("contributes announcement admin models", () => {
    const contribution = new AnnouncementsApp().adminContribution();
    expect(contribution.models?.length).toBe(3);
    expect(contribution.models?.[0]?.routePath).toBe("/announcements");
  });

  it("publishes draft announcements and returns them as pending", async () => {
    const createRes = await adminAgent
      .post("/announcements")
      .send({
        body: "## Welcome\n\nCheck out the new feature.",
        requiresAcknowledgement: true,
        title: "New feature",
      })
      .expect(201);

    const announcementId = createRes.body.data._id as string;
    await adminAgent.post(`/announcements/${announcementId}/publish`).expect(200);

    const pendingRes = await userAgent.get("/announcements/pending?platform=web").expect(200);
    expect(pendingRes.body.data.current?.id).toBe(announcementId);
    expect(pendingRes.body.data.remainingCount).toBe(0);
  });

  it("clears pending after acknowledgement", async () => {
    const announcement = await Announcement.create({
      body: "Body",
      publishedAt: DateTime.utc().toJSDate(),
      requiresAcknowledgement: true,
      status: "published",
      title: "Shipped",
      version: 1,
    });

    await userAgent.get("/announcements/pending?platform=web").expect(200);
    await userAgent.post(`/announcements/${announcement._id.toString()}/acknowledge`).expect(200);

    const pendingRes = await userAgent.get("/announcements/pending?platform=web").expect(200);
    expect(pendingRes.body.data.current).toBeNull();
  });

  it("bumps version when published title/body changes", async () => {
    const announcement = await Announcement.create({
      body: "Body v1",
      publishedAt: DateTime.utc().toJSDate(),
      requiresAcknowledgement: true,
      status: "published",
      title: "Title v1",
      version: 1,
    });

    await userAgent.post(`/announcements/${announcement._id.toString()}/acknowledge`).expect(200);

    announcement.body = "Body v2";
    await announcement.save();

    const pendingRes = await userAgent.get("/announcements/pending?platform=web").expect(200);
    expect(pendingRes.body.data.current?.version).toBe(2);
  });

  it("rejects non-admins from admin CRUD", async () => {
    await userAgent.get("/announcements").expect(405);
  });
});
