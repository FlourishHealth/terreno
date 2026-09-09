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

const buildApp = (): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new AnnouncementsApp({help: {enabled: true}}).register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("announcement help routes", () => {
  let userAgent: TestAgent;
  let publishedId: string;
  let archivedId: string;

  beforeEach(async () => {
    await setupDb();
    await Announcement.deleteMany({});
    const app = buildApp();
    userAgent = await authAsUser(app, "notAdmin");

    const published = await Announcement.create({
      body: "Published body about billing",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Billing update",
    });
    publishedId = published._id.toString();

    const archived = await Announcement.create({
      archivedAt: DateTime.utc().toJSDate(),
      body: "Archived migration guide",
      publishedAt: DateTime.utc().minus({days: 30}).toJSDate(),
      status: "archived",
      title: "Legacy migration",
    });
    archivedId = archived._id.toString();
  });

  afterEach(async () => {
    await Announcement.deleteMany({});
  });

  it("searches published notes by default", async () => {
    const res = await userAgent.get("/announcements/help/search?q=billing").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(publishedId);
  });

  it("includes archived notes when requested", async () => {
    const res = await userAgent
      .get("/announcements/help/search?includeArchived=true&q=migration")
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(archivedId);
    expect(res.body.data[0].status).toBe("archived");
  });

  it("returns the full update note by id", async () => {
    const res = await userAgent
      .get(`/announcements/help/${archivedId}?includeArchived=true`)
      .expect(200);
    expect(res.body.data.title).toBe("Legacy migration");
    expect(res.body.data.body).toContain("Archived migration guide");
    expect(res.body.data.status).toBe("archived");
  });
});
