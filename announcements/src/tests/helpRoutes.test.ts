import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type express from "express";
import {DateTime} from "luxon";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import {AnnouncementsApp} from "../announcementsApp";
import {Announcement} from "../models/announcement";

const buildApp = (options?: {
  isStaff?: (user: unknown) => boolean;
  matchAudience?: (user: unknown, announcement: unknown) => boolean;
}): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new AnnouncementsApp({help: {enabled: true}, ...options}).register(app);
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

  it("returns 404 for missing or draft notes", async () => {
    const draft = await Announcement.create({
      body: "Draft only",
      status: "draft",
      title: "Draft",
    });
    await userAgent.get(`/announcements/help/${draft._id.toString()}`).expect(404);
    await userAgent.get("/announcements/help/000000000000000000000000").expect(404);
  });

  it("hides scheduled announcements until publishAt", async () => {
    const scheduled = await Announcement.create({
      body: "Future release notes",
      publishAt: DateTime.utc().plus({days: 2}).toJSDate(),
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Future billing update",
    });

    const res = await userAgent.get("/announcements/help/search?q=future").expect(200);
    expect(res.body.data).toHaveLength(0);

    const detail = await userAgent
      .get(`/announcements/help/${scheduled._id.toString()}`)
      .expect(404);
    expect(detail.body.title).toBeDefined();
  });

  it("supports array query params, includeArchived=1, and limit", async () => {
    const res = await userAgent
      .get("/announcements/help/search?includeArchived=1&limit=1&q=billing&q=legacy")
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("hides help results below minBuildNumber when version is present", async () => {
    await Announcement.deleteMany({});

    await Announcement.create({
      body: "Visible billing notes",
      minBuildNumber: 10,
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Billing v10",
    });
    await Announcement.create({
      body: "Future billing notes",
      minBuildNumber: 20,
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Billing v20",
    });

    const hidden = await userAgent
      .get("/announcements/help/search?q=billing&version=9")
      .expect(200);
    assert.lengthOf(hidden.body.data, 0);

    const visible = await userAgent
      .get("/announcements/help/search?q=billing&version=10")
      .expect(200);
    assert.lengthOf(visible.body.data, 1);
    assert.strictEqual(visible.body.data[0].title, "Billing v10");

    const omitted = await userAgent.get("/announcements/help/search?q=billing").expect(200);
    assert.lengthOf(omitted.body.data, 2);
  });

  it("returns 401 for unauthenticated help search and detail", async () => {
    const app = buildApp();
    await supertest(app).get("/announcements/help/search?q=billing").expect(401);
    await supertest(app).get(`/announcements/help/${publishedId}`).expect(401);
  });

  it("returns 404 for help detail when version is below minBuildNumber", async () => {
    const gated = await Announcement.create({
      body: "Gated release notes",
      minBuildNumber: 25,
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Build 25 feature",
    });

    await userAgent.get(`/announcements/help/${gated._id.toString()}?version=24`).expect(404);
    await userAgent.get(`/announcements/help/${gated._id.toString()}?version=25`).expect(200);
  });

  it("hides help results that fail audienceType or matchAudience", async () => {
    await Announcement.deleteMany({});

    const audienceApp = buildApp({
      isStaff: (user) => (user as {admin?: boolean}).admin === true,
      matchAudience: (_user, announcement) => {
        const audience = announcement as {audience?: {include?: boolean}};
        return audience.audience?.include !== false;
      },
    });
    const patientAgent = await authAsUser(audienceApp, "notAdmin");

    const staffOnly = await Announcement.create({
      audience: {include: true},
      audienceType: "staff",
      body: "Staff billing notes",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Staff billing",
    });
    await Announcement.create({
      audience: {include: false},
      audienceType: "all",
      body: "Excluded billing notes",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Excluded billing",
    });

    const search = await patientAgent.get("/announcements/help/search?q=billing").expect(200);
    assert.lengthOf(search.body.data, 0);

    await patientAgent.get(`/announcements/help/${staffOnly._id.toString()}`).expect(404);
  });

  it("sorts help search results by priority then publishedAt", async () => {
    await Announcement.deleteMany({});

    await Announcement.create({
      body: "Older high priority",
      priority: 10,
      publishedAt: DateTime.utc().minus({days: 5}).toJSDate(),
      status: "published",
      title: "Priority sort high old",
    });
    await Announcement.create({
      body: "Newer high priority",
      priority: 10,
      publishedAt: DateTime.utc().minus({days: 1}).toJSDate(),
      status: "published",
      title: "Priority sort high new",
    });
    await Announcement.create({
      body: "Low priority",
      priority: 1,
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Priority sort low",
    });

    const res = await userAgent.get("/announcements/help/search?q=Priority%20sort").expect(200);
    assert.lengthOf(res.body.data, 3);
    assert.strictEqual(res.body.data[0].title, "Priority sort high new");
    assert.strictEqual(res.body.data[1].title, "Priority sort high old");
    assert.strictEqual(res.body.data[2].title, "Priority sort low");
  });
});
