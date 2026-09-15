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
import type TestAgent from "supertest/lib/agent";
import {AnnouncementsApp} from "../announcementsApp";
import {Announcement} from "../models/announcement";
import {AnnouncementAcknowledgement} from "../models/announcementAcknowledgement";
import {AnnouncementImpression} from "../models/announcementImpression";

const buildApp = (options?: {
  basePath?: string;
  defaultAcknowledgementPolicy?: "required" | "dismiss-only";
  isStaff?: (user: unknown) => boolean;
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
    await AnnouncementImpression.deleteMany({});
    app = buildApp();
    adminAgent = await authAsUser(app, "admin");
    userAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await Announcement.deleteMany({});
    await AnnouncementAcknowledgement.deleteMany({});
    await AnnouncementImpression.deleteMany({});
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
        acknowledgementPolicy: "required",
        body: "## Welcome\n\nCheck out the new feature.",
        title: "New feature",
      })
      .expect(201);

    const announcementId = createRes.body.data._id as string;
    await adminAgent.post(`/announcements/${announcementId}/publish`).expect(200);

    const pendingRes = await userAgent.get("/announcements/pending?platform=web").expect(200);
    expect(pendingRes.body.data.current?.id).toBe(announcementId);
    expect(pendingRes.body.data.current?.requiresAcknowledgement).toBe(true);
    expect(pendingRes.body.data.remainingCount).toBe(0);
  });

  it("resolves requiresAcknowledgement on GET pending for each policy case", async () => {
    const requiredApp = buildApp();
    const requiredUser = await authAsUser(requiredApp, "notAdmin");

    const requiredAnnouncement = await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Required body",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Required ack",
      version: 1,
    });

    const requiredRes = await requiredUser.get("/announcements/pending?platform=web").expect(200);
    expect(requiredRes.body.data.current?.id).toBe(requiredAnnouncement._id.toString());
    expect(requiredRes.body.data.current?.requiresAcknowledgement).toBe(true);

    await Announcement.deleteMany({});

    const dismissAnnouncement = await Announcement.create({
      acknowledgementPolicy: "dismiss-only",
      body: "Dismiss body",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Dismiss only",
      version: 1,
    });

    const dismissRes = await requiredUser.get("/announcements/pending?platform=web").expect(200);
    expect(dismissRes.body.data.current?.id).toBe(dismissAnnouncement._id.toString());
    expect(dismissRes.body.data.current?.requiresAcknowledgement).toBe(false);

    await Announcement.deleteMany({});

    const defaultApp = buildApp({defaultAcknowledgementPolicy: "required"});
    const defaultUser = await authAsUser(defaultApp, "notAdmin");
    const omittedAnnouncement = await Announcement.create({
      body: "Default policy body",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Omitted policy",
      version: 1,
    });

    const defaultRes = await defaultUser.get("/announcements/pending?platform=web").expect(200);
    expect(defaultRes.body.data.current?.id).toBe(omittedAnnouncement._id.toString());
    expect(defaultRes.body.data.current?.requiresAcknowledgement).toBe(true);

    await Announcement.deleteMany({});

    const legacyAnnouncement = await Announcement.collection.insertOne({
      body: "Legacy body",
      created: DateTime.utc().toJSDate(),
      platforms: ["web"],
      priority: 0,
      publishedAt: DateTime.utc().toJSDate(),
      requiresAcknowledgement: true,
      status: "published",
      title: "Legacy boolean",
      updated: DateTime.utc().toJSDate(),
      version: 1,
    });

    const legacyRes = await requiredUser.get("/announcements/pending?platform=web").expect(200);
    expect(legacyRes.body.data.current?.id).toBe(legacyAnnouncement.insertedId.toString());
    expect(legacyRes.body.data.current?.requiresAcknowledgement).toBe(true);
  });

  it("clears pending after acknowledgement", async () => {
    const announcement = await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Body",
      publishedAt: DateTime.utc().toJSDate(),
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
      acknowledgementPolicy: "required",
      body: "Body v1",
      publishedAt: DateTime.utc().toJSDate(),
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

  it("rejects invalid publish and archive transitions", async () => {
    const published = await Announcement.create({
      body: "Body",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Already published",
      version: 1,
    });

    await adminAgent.post(`/announcements/${published._id.toString()}/publish`).expect(400);

    const draft = await Announcement.create({
      body: "Draft body",
      status: "draft",
      title: "Draft",
      version: 1,
    });

    await adminAgent.post(`/announcements/${draft._id.toString()}/archive`).expect(400);
  });

  it("records impressions and keeps duplicate acknowledgements idempotent", async () => {
    const announcement = await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Body",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Track views",
      version: 1,
    });

    const announcementId = announcement._id.toString();
    await userAgent
      .post(`/announcements/${announcementId}/impression`)
      .send({platform: "web"})
      .expect(200);

    const impressions = await AnnouncementImpression.find({announcementId: announcement._id});
    expect(impressions.length).toBe(1);
    expect(impressions[0]?.platform).toBe("web");

    await userAgent.post(`/announcements/${announcementId}/acknowledge`).expect(200);
    await userAgent.post(`/announcements/${announcementId}/acknowledge`).expect(200);

    const acknowledgements = await AnnouncementAcknowledgement.find({
      announcementId: announcement._id,
    });
    expect(acknowledgements.length).toBe(1);
  });

  it("filters pending announcements with matchAudience", async () => {
    await Announcement.deleteMany({});
    await AnnouncementImpression.deleteMany({});
    await AnnouncementAcknowledgement.deleteMany({});

    const targetedApp = buildApp({
      matchAudience: (_user, announcement) => {
        const audience = announcement as {audience?: {include?: boolean}};
        return audience.audience?.include !== false;
      },
    });
    const targetedUserAgent = await authAsUser(targetedApp, "notAdmin");

    await Announcement.create({
      acknowledgementPolicy: "required",
      audience: {include: true},
      body: "Visible",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Included",
      version: 1,
    });
    await Announcement.create({
      acknowledgementPolicy: "required",
      audience: {include: false},
      body: "Hidden",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Excluded",
      version: 1,
    });

    const pendingRes = await targetedUserAgent
      .get("/announcements/pending?platform=web")
      .expect(200);

    expect(pendingRes.body.data.current?.title).toBe("Included");
    expect(pendingRes.body.data.remainingCount).toBe(0);
  });

  it("returns a paginated announcement feed", async () => {
    await Announcement.create({
      body: "Feed body",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Feed item",
      version: 1,
    });

    const feedRes = await userAgent
      .get("/announcements/feed?page=1&limit=10&platform=web")
      .expect(200);
    expect(feedRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(feedRes.body.total).toBeGreaterThanOrEqual(1);
    expect(feedRes.body.page).toBe(1);
  });

  it("GET pending omits feed displayMode and GET feed includes feed-only items", async () => {
    await Announcement.deleteMany({});

    const modal = await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Modal body",
      displayMode: "modal",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Modal item",
      version: 1,
    });
    await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Feed body",
      displayMode: "feed",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Feed only",
      version: 1,
    });

    const pendingRes = await userAgent.get("/announcements/pending?platform=web").expect(200);
    assert.strictEqual(pendingRes.body.data.current?.id, modal._id.toString());
    assert.strictEqual(pendingRes.body.data.current?.displayMode, "modal");

    const feedRes = await userAgent
      .get("/announcements/feed?page=1&limit=10&platform=web")
      .expect(200);
    const feedTitles = feedRes.body.data.map((item: {title: string}) => item.title);
    assert.include(feedTitles, "Modal item");
    assert.include(feedTitles, "Feed only");
  });

  it("GET pending and feed honor minBuildNumber when version query is present", async () => {
    await Announcement.deleteMany({});

    const visible = await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Visible body",
      minBuildNumber: 10,
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Visible at 10",
      version: 1,
    });
    await Announcement.create({
      acknowledgementPolicy: "required",
      body: "Hidden body",
      minBuildNumber: 20,
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Hidden below 20",
      version: 1,
    });

    const pendingHidden = await userAgent
      .get("/announcements/pending?platform=web&version=9")
      .expect(200);
    assert.isNull(pendingHidden.body.data.current);

    const pendingVisible = await userAgent
      .get("/announcements/pending?platform=web&version=10")
      .expect(200);
    assert.strictEqual(pendingVisible.body.data.current?.id, visible._id.toString());

    const feedHidden = await userAgent
      .get("/announcements/feed?platform=web&version=9")
      .expect(200);
    assert.lengthOf(feedHidden.body.data, 0);

    const feedOmitted = await userAgent.get("/announcements/feed?platform=web").expect(200);
    assert.isAtLeast(feedOmitted.body.data.length, 2);
  });

  it("filters pending by audienceType composed with matchAudience", async () => {
    await Announcement.deleteMany({});

    const audienceApp = buildApp({
      isStaff: (user) => (user as {admin?: boolean}).admin === true,
      matchAudience: (_user, announcement) => {
        const audience = announcement as {audience?: {include?: boolean}};
        return audience.audience?.include !== false;
      },
    });
    const staffAgent = await authAsUser(audienceApp, "admin");
    const patientAgent = await authAsUser(audienceApp, "notAdmin");

    await Announcement.create({
      acknowledgementPolicy: "required",
      audience: {include: true},
      audienceType: "staff",
      body: "Staff only",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Staff modal",
      version: 1,
    });
    await Announcement.create({
      acknowledgementPolicy: "required",
      audience: {include: true},
      audienceType: "patient",
      body: "Patient only",
      publishedAt: DateTime.utc().toJSDate(),
      status: "published",
      title: "Patient modal",
      version: 1,
    });

    const staffPending = await staffAgent.get("/announcements/pending?platform=web").expect(200);
    assert.strictEqual(staffPending.body.data.current?.title, "Staff modal");

    const patientPending = await patientAgent
      .get("/announcements/pending?platform=web")
      .expect(200);
    assert.strictEqual(patientPending.body.data.current?.title, "Patient modal");
  });
});
