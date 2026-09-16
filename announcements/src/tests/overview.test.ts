import {afterEach, beforeEach, describe, it} from "bun:test";
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
import {AnnouncementAcknowledgement} from "../models/announcementAcknowledgement";
import {AnnouncementClickEvent} from "../models/announcementClickEvent";
import {AnnouncementImpression} from "../models/announcementImpression";
import type {AnnouncementsOptions} from "../types";

const buildApp = (options?: AnnouncementsOptions): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new AnnouncementsApp(options).register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("GET /announcements/overview", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let userAgent: TestAgent;
  let userId: string;

  beforeEach(async () => {
    const [, notAdminUser] = await setupDb();
    userId = notAdminUser._id.toString();
    await Announcement.deleteMany({});
    await AnnouncementAcknowledgement.deleteMany({});
    await AnnouncementImpression.deleteMany({});
    await AnnouncementClickEvent.deleteMany({});

    app = buildApp({defaultAcknowledgementPolicy: "dismiss-only"});
    adminAgent = await authAsUser(app, "admin");
    userAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await Announcement.deleteMany({});
    await AnnouncementAcknowledgement.deleteMany({});
    await AnnouncementImpression.deleteMany({});
    await AnnouncementClickEvent.deleteMany({});
  });

  it("returns exact per-row metrics and totals across announcements and event versions", async () => {
    const highPriority = await Announcement.create({
      acknowledgementPolicy: "required",
      audienceType: "staff",
      body: "High priority body",
      displayMode: "modal",
      expiresAt: DateTime.utc().plus({days: 30}).toJSDate(),
      priority: 10,
      publishedAt: DateTime.utc().minus({hours: 1}).toJSDate(),
      status: "published",
      title: "High priority",
      version: 2,
    });
    const lowPriority = await Announcement.create({
      body: "Draft body",
      displayMode: "banner",
      priority: 1,
      status: "draft",
      title: "Draft item",
      version: 1,
    });
    const archived = await Announcement.create({
      body: "Archived body",
      displayMode: "feed",
      priority: 5,
      publishedAt: DateTime.utc().minus({days: 10}).toJSDate(),
      status: "archived",
      title: "Archived item",
      version: 3,
    });

    await AnnouncementImpression.create([
      {
        announcementId: highPriority._id,
        platform: "web",
        userId,
        version: 1,
        viewedAt: DateTime.utc().toJSDate(),
      },
      {
        announcementId: highPriority._id,
        platform: "web",
        userId,
        version: 2,
        viewedAt: DateTime.utc().toJSDate(),
      },
      {
        announcementId: archived._id,
        platform: "ios",
        userId,
        version: 3,
        viewedAt: DateTime.utc().toJSDate(),
      },
    ]);
    await AnnouncementAcknowledgement.create([
      {
        acknowledgedAt: DateTime.utc().toJSDate(),
        announcementId: highPriority._id,
        userId,
        version: 1,
      },
      {
        acknowledgedAt: DateTime.utc().toJSDate(),
        announcementId: highPriority._id,
        userId,
        version: 2,
      },
    ]);
    await AnnouncementClickEvent.create([
      {
        action: "primaryAction",
        announcementId: highPriority._id,
        clickedAt: DateTime.utc().toJSDate(),
        platform: "web",
        userId,
        version: 2,
      },
      {
        action: "primaryAction",
        announcementId: archived._id,
        clickedAt: DateTime.utc().toJSDate(),
        platform: "web",
        userId,
        version: 3,
      },
      {
        action: "primaryAction",
        announcementId: archived._id,
        clickedAt: DateTime.utc().toJSDate(),
        platform: "web",
        userId,
        version: 3,
      },
    ]);

    const res = await adminAgent.get("/announcements/overview?page=1&limit=20").expect(200);

    assert.strictEqual(res.body.page, 1);
    assert.strictEqual(res.body.limit, 20);
    assert.strictEqual(res.body.total, 3);
    assert.strictEqual(res.body.more, false);

    assert.strictEqual(res.body.totals.announcements, 3);
    assert.strictEqual(res.body.totals.published, 1);
    assert.strictEqual(res.body.totals.draft, 1);
    assert.strictEqual(res.body.totals.archived, 1);
    assert.strictEqual(res.body.totals.impressions, 3);
    assert.strictEqual(res.body.totals.acknowledgements, 2);
    assert.strictEqual(res.body.totals.clicks, 3);

    assert.lengthOf(res.body.data, 3);
    assert.strictEqual(res.body.data[0]._id, highPriority._id.toString());
    assert.strictEqual(res.body.data[0].title, "High priority");
    assert.strictEqual(res.body.data[0].status, "published");
    assert.strictEqual(res.body.data[0].displayMode, "modal");
    assert.strictEqual(res.body.data[0].audienceType, "staff");
    assert.strictEqual(res.body.data[0].acknowledgementPolicy, "required");
    assert.strictEqual(res.body.data[0].priority, 10);
    assert.strictEqual(res.body.data[0].version, 2);
    assert.isOk(res.body.data[0].publishedAt);
    assert.isOk(res.body.data[0].expiresAt);
    assert.deepStrictEqual(res.body.data[0].metrics, {
      acknowledgements: 2,
      clicks: 1,
      impressions: 2,
    });

    const draftRow = res.body.data.find(
      (row: {_id: string}) => row._id === lowPriority._id.toString()
    );
    assert.isOk(draftRow);
    assert.strictEqual(draftRow.displayMode, "banner");
    assert.strictEqual(draftRow.status, "draft");
    assert.isUndefined(draftRow.publishedAt);
    assert.deepStrictEqual(draftRow.metrics, {
      acknowledgements: 0,
      clicks: 0,
      impressions: 0,
    });

    const archivedRow = res.body.data.find(
      (row: {_id: string}) => row._id === archived._id.toString()
    );
    assert.isOk(archivedRow);
    assert.strictEqual(archivedRow.displayMode, "feed");
    assert.strictEqual(archivedRow.status, "archived");
    assert.deepStrictEqual(archivedRow.metrics, {
      acknowledgements: 0,
      clicks: 2,
      impressions: 1,
    });
  });

  it("paginates deterministically by priority desc then publishedAt desc", async () => {
    await Announcement.create({
      body: "A",
      priority: 5,
      publishedAt: DateTime.utc().minus({days: 2}).toJSDate(),
      status: "published",
      title: "Older high",
      version: 1,
    });
    await Announcement.create({
      body: "B",
      priority: 5,
      publishedAt: DateTime.utc().minus({days: 1}).toJSDate(),
      status: "published",
      title: "Newer high",
      version: 1,
    });
    await Announcement.create({
      body: "C",
      priority: 1,
      publishedAt: DateTime.utc().minus({hours: 1}).toJSDate(),
      status: "published",
      title: "Low priority",
      version: 1,
    });

    const pageOne = await adminAgent.get("/announcements/overview?page=1&limit=2").expect(200);
    assert.strictEqual(pageOne.body.total, 3);
    assert.strictEqual(pageOne.body.more, true);
    assert.lengthOf(pageOne.body.data, 2);
    assert.strictEqual(pageOne.body.data[0].title, "Newer high");
    assert.strictEqual(pageOne.body.data[1].title, "Older high");

    const pageTwo = await adminAgent.get("/announcements/overview?page=2&limit=2").expect(200);
    assert.strictEqual(pageTwo.body.more, false);
    assert.lengthOf(pageTwo.body.data, 1);
    assert.strictEqual(pageTwo.body.data[0].title, "Low priority");
  });

  it("defaults limit to 20, caps at 100, and returns an empty overview", async () => {
    const defaultRes = await adminAgent.get("/announcements/overview").expect(200);
    assert.strictEqual(defaultRes.body.limit, 20);
    assert.strictEqual(defaultRes.body.page, 1);
    assert.strictEqual(defaultRes.body.total, 0);
    assert.strictEqual(defaultRes.body.more, false);
    assert.lengthOf(defaultRes.body.data, 0);
    assert.deepStrictEqual(defaultRes.body.totals, {
      acknowledgements: 0,
      announcements: 0,
      archived: 0,
      clicks: 0,
      draft: 0,
      impressions: 0,
      published: 0,
    });

    const cappedRes = await adminAgent.get("/announcements/overview?page=0&limit=500").expect(200);
    assert.strictEqual(cappedRes.body.limit, 100);
    assert.strictEqual(cappedRes.body.page, 1);

    const invalidRes = await adminAgent
      .get("/announcements/overview?page=not-a-number&limit=also-invalid")
      .expect(200);
    assert.strictEqual(invalidRes.body.limit, 20);
    assert.strictEqual(invalidRes.body.page, 1);
  });

  it("excludes soft-deleted announcements and event rows from totals and metrics", async () => {
    const live = await Announcement.create({
      body: "Live",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Live",
      version: 1,
    });
    const deletedAnnouncement = await Announcement.create({
      body: "Deleted",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Deleted",
      version: 1,
    });
    await Announcement.updateOne({_id: deletedAnnouncement._id}, {deleted: true});

    await AnnouncementImpression.create({
      announcementId: live._id,
      platform: "web",
      userId,
      version: 1,
      viewedAt: DateTime.utc().toJSDate(),
    });
    const deletedImpression = await AnnouncementImpression.create({
      announcementId: live._id,
      platform: "web",
      userId,
      version: 1,
      viewedAt: DateTime.utc().toJSDate(),
    });
    await AnnouncementImpression.updateOne({_id: deletedImpression._id}, {deleted: true});

    const res = await adminAgent.get("/announcements/overview").expect(200);
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.totals.announcements, 1);
    assert.strictEqual(res.body.totals.impressions, 1);
    assert.strictEqual(res.body.data[0].metrics.impressions, 1);
  });

  it("resolves omitted acknowledgementPolicy from plugin default", async () => {
    const defaultApp = buildApp({defaultAcknowledgementPolicy: "required"});
    const defaultAdmin = await authAsUser(defaultApp, "admin");

    await Announcement.create({
      body: "Uses default",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Default policy",
      version: 1,
    });

    const res = await defaultAdmin.get("/announcements/overview").expect(200);
    assert.strictEqual(res.body.data[0].acknowledgementPolicy, "required");
  });

  it("returns 403 for non-admin users", async () => {
    const res = await userAgent.get("/announcements/overview").expect(403);
    assert.strictEqual(res.body.title, "Admin access required");
  });

  it("allows consumers to use an RBAC permission method instead of legacy admin flag", async () => {
    const rbacApp = buildApp({
      adminOverviewPermissions: [(): boolean => true],
    });
    const rbacUser = await authAsUser(rbacApp, "notAdmin");

    await rbacUser.get("/announcements/overview").expect(200);
  });

  it("returns 401 for unauthenticated requests", async () => {
    await supertest(app).get("/announcements/overview").expect(401);
  });
});
