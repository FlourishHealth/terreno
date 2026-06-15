// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import {ConsentApp, type ConsentAppOptions} from "./consentApp";
import {hashConsentLinkToken} from "./consentLinkTokens";
import {ConsentForm} from "./models/consentForm";
import {ConsentLink} from "./models/consentLink";
import {ConsentResponse} from "./models/consentResponse";
import {TerrenoApp} from "./terrenoApp";
import {authAsUser, setupDb, UserModel} from "./tests";

const SIGNED_LINKS = {
  enabled: true,
  linkBaseUrl: "https://app.example.com/consents/sign",
};

const buildApp = (consentAppOptions: ConsentAppOptions = {}): express.Application =>
  new TerrenoApp({
    skipListen: true,
    userModel: UserModel as any,
  })
    .register(new ConsentApp(consentAppOptions))
    .build();

const createActiveForm = async (overrides: Record<string, unknown> = {}): Promise<any> =>
  ConsentForm.create({
    active: true,
    content: new Map([["en", "# Terms\nPlease agree."]]),
    order: 1,
    slug: `terms-${Math.random().toString(36).slice(2)}`,
    title: "Terms of Service",
    type: "terms",
    version: 1,
    ...overrides,
  });

describe("ConsentApp signed links", () => {
  let admin: any;
  let notAdmin: any;
  let adminAgent: TestAgent;
  let userAgent: TestAgent;
  let app: express.Application;

  beforeEach(async () => {
    [admin, notAdmin] = await setupDb();
    await Promise.all([
      ConsentForm.deleteMany({}),
      ConsentResponse.deleteMany({}),
      ConsentLink.deleteMany({}),
    ]);
    app = buildApp({auditTrail: true, signedLinks: SIGNED_LINKS});
    adminAgent = await authAsUser(app, "admin");
    userAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await Promise.all([
      ConsentForm.deleteMany({}),
      ConsentResponse.deleteMany({}),
      ConsentLink.deleteMany({}),
    ]);
  });

  describe("POST /consents/links (generate)", () => {
    it("generates a link for a user and returns the token exactly once", async () => {
      const res = await adminAgent.post("/consents/links").send({userId: notAdmin._id}).expect(200);

      expect(res.body.data.token).toBeDefined();
      expect(typeof res.body.data.token).toBe("string");
      expect(res.body.data.url).toContain("token=");
      expect(res.body.data.expiresAt).toBeDefined();

      // Only the hash is stored, never the raw token.
      const link = await ConsentLink.findById(res.body.data._id);
      expect(link).not.toBeNull();
      expect(link?.tokenHash).toBe(hashConsentLinkToken(res.body.data.token));
      expect((link as any)?.token).toBeUndefined();
      expect(String(link?.userId)).toBe(String(notAdmin._id));
      expect(link?.createdByUserId).toBeDefined();
    });

    it("defaults maxUses to 1", async () => {
      const res = await adminAgent.post("/consents/links").send({userId: notAdmin._id}).expect(200);
      const link = await ConsentLink.findById(res.body.data._id);
      expect(link?.maxUses).toBe(1);
    });

    it("honors expiresIn, maxUses, note, and consentFormIds", async () => {
      const form = await createActiveForm();
      const res = await adminAgent
        .post("/consents/links")
        .send({
          consentFormIds: [form._id],
          expiresIn: "1h",
          maxUses: 3,
          note: "onboarding",
          userId: notAdmin._id,
        })
        .expect(200);

      const link = await ConsentLink.findById(res.body.data._id);
      expect(link?.maxUses).toBe(3);
      expect(link?.note).toBe("onboarding");
      expect(link?.consentFormIds?.map(String)).toEqual([String(form._id)]);
      // ~1 hour from now
      const diffMs = new Date(res.body.data.expiresAt).getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(50 * 60 * 1000);
      expect(diffMs).toBeLessThan(70 * 60 * 1000);
    });

    it("returns 400 when userId is missing", async () => {
      await adminAgent.post("/consents/links").send({}).expect(400);
    });

    it("returns 404 when user does not exist", async () => {
      await adminAgent
        .post("/consents/links")
        .send({userId: "64b7f3f3f3f3f3f3f3f3f3f3"})
        .expect(404);
    });

    it("blocks non-admins from generating links", async () => {
      await userAgent.post("/consents/links").send({userId: notAdmin._id}).expect(403);
    });

    it("returns 404 when signedLinks is disabled", async () => {
      const disabledApp = buildApp({});
      const disabledAdmin = await authAsUser(disabledApp, "admin");
      await disabledAdmin.post("/consents/links").send({userId: notAdmin._id}).expect(404);
    });
  });

  describe("GET /consents/links (list)", () => {
    it("lists links without exposing token hash", async () => {
      await adminAgent.post("/consents/links").send({userId: notAdmin._id}).expect(200);

      const res = await adminAgent.get("/consents/links").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].tokenHash).toBeUndefined();
      expect(res.body.data[0].userId).toBeDefined();
    });

    it("filters by userId", async () => {
      await adminAgent.post("/consents/links").send({userId: notAdmin._id}).expect(200);
      await adminAgent.post("/consents/links").send({userId: admin._id}).expect(200);

      const res = await adminAgent
        .get("/consents/links")
        .query({userId: String(notAdmin._id)})
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(String(res.body.data[0].userId)).toBe(String(notAdmin._id));
    });

    it("blocks non-admins", async () => {
      await userAgent.get("/consents/links").expect(403);
    });
  });

  describe("POST /consents/links/:id/revoke", () => {
    it("revokes a link", async () => {
      const gen = await adminAgent.post("/consents/links").send({userId: notAdmin._id}).expect(200);

      await adminAgent.post(`/consents/links/${gen.body.data._id}/revoke`).expect(200);

      const link = await ConsentLink.findById(gen.body.data._id);
      expect(link?.revoked).toBe(true);
    });

    it("blocks non-admins", async () => {
      const gen = await adminAgent.post("/consents/links").send({userId: notAdmin._id}).expect(200);
      await userAgent.post(`/consents/links/${gen.body.data._id}/revoke`).expect(403);
    });
  });

  describe("GET /consents/link/:token (public)", () => {
    const generateToken = async (body: Record<string, unknown> = {}): Promise<string> => {
      const res = await adminAgent
        .post("/consents/links")
        .send({userId: notAdmin._id, ...body})
        .expect(200);
      return res.body.data.token;
    };

    it("returns the user's pending forms without authentication", async () => {
      await createActiveForm({slug: "public-terms", title: "Public Terms"});
      const token = await generateToken();

      const res = await supertest(app).get(`/consents/link/${token}`).expect(200);
      expect(res.body.data.forms).toHaveLength(1);
      expect(res.body.data.forms[0].title).toBe("Public Terms");
      expect(res.body.data.context.formCount).toBe(1);
      expect(res.body.data.context.name).toBe("Not Admin");
    });

    it("scopes forms to consentFormIds when provided", async () => {
      const formA = await createActiveForm({order: 1, slug: "scoped-a", title: "Form A"});
      await createActiveForm({order: 2, slug: "scoped-b", title: "Form B"});
      const token = await generateToken({consentFormIds: [formA._id]});

      const res = await supertest(app).get(`/consents/link/${token}`).expect(200);
      expect(res.body.data.forms).toHaveLength(1);
      expect(res.body.data.forms[0].title).toBe("Form A");
    });

    it("returns 404 for an unknown token", async () => {
      await supertest(app).get("/consents/link/not-a-real-token").expect(404);
    });

    it("returns 410 for an expired link", async () => {
      const token = await generateToken();
      await ConsentLink.updateOne(
        {tokenHash: hashConsentLinkToken(token)},
        {expiresAt: new Date(Date.now() - 1000)}
      );
      await supertest(app).get(`/consents/link/${token}`).expect(410);
    });

    it("returns 410 for a revoked link", async () => {
      const token = await generateToken();
      await ConsentLink.updateOne({tokenHash: hashConsentLinkToken(token)}, {revoked: true});
      await supertest(app).get(`/consents/link/${token}`).expect(410);
    });
  });

  describe("POST /consents/link/:token/respond (public)", () => {
    const generateToken = async (body: Record<string, unknown> = {}): Promise<string> => {
      const res = await adminAgent
        .post("/consents/links")
        .send({userId: notAdmin._id, ...body})
        .expect(200);
      return res.body.data.token;
    };

    it("records a response for the link's user without authentication", async () => {
      const form = await createActiveForm({slug: "respond-link", title: "Respond Link"});
      const token = await generateToken();

      const res = await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(200);

      expect(res.body.data.agreed).toBe(true);
      expect(String(res.body.data.userId)).toBe(String(notAdmin._id));
      expect(res.body.data.submittedViaLinkId).toBeDefined();

      const stored = await ConsentResponse.findById(res.body.data._id);
      expect(stored?.contentSnapshot).toContain("Terms");

      // Link usage tracked
      const link = await ConsentLink.findOne({tokenHash: hashConsentLinkToken(token)});
      expect(link?.useCount).toBe(1);
      expect(link?.usedAt).toBeDefined();
    });

    it("enforces single-use (maxUses 1) with 410 on the second use", async () => {
      const form = await createActiveForm({slug: "single-use", title: "Single Use"});
      const token = await generateToken();

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(200);

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(410);
    });

    it("allows multiple uses when maxUses is 0", async () => {
      const formA = await createActiveForm({order: 1, slug: "multi-a", title: "Multi A"});
      const formB = await createActiveForm({order: 2, slug: "multi-b", title: "Multi B"});
      const token = await generateToken({maxUses: 0});

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: formA._id, locale: "en"})
        .expect(200);
      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: formB._id, locale: "en"})
        .expect(200);
    });

    it("rejects forms outside the link's scope with 403", async () => {
      const formA = await createActiveForm({order: 1, slug: "in-scope", title: "In Scope"});
      const formB = await createActiveForm({order: 2, slug: "out-scope", title: "Out Scope"});
      const token = await generateToken({consentFormIds: [formA._id]});

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: formB._id, locale: "en"})
        .expect(403);
    });

    it("validates required checkboxes", async () => {
      const form = await createActiveForm({
        checkboxes: [{label: "I confirm", required: true}],
        slug: "cb-link",
        title: "Checkbox Link",
      });
      const token = await generateToken({maxUses: 0});

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, checkboxValues: {"0": false}, consentFormId: form._id, locale: "en"})
        .expect(400);

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, checkboxValues: {"0": true}, consentFormId: form._id, locale: "en"})
        .expect(200);
    });

    it("returns 410 for an expired link", async () => {
      const form = await createActiveForm({slug: "expired-respond", title: "Expired"});
      const token = await generateToken();
      await ConsentLink.updateOne(
        {tokenHash: hashConsentLinkToken(token)},
        {expiresAt: new Date(Date.now() - 1000)}
      );
      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(410);
    });

    it("surfaces link-submitted responses in the user audit history", async () => {
      const form = await createActiveForm({slug: "audit-link", title: "Audit Link"});
      const token = await generateToken();

      await supertest(app)
        .post(`/consents/link/${token}/respond`)
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(200);

      const res = await adminAgent.get(`/consents/audit/${notAdmin._id}`).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].form.title).toBe("Audit Link");
    });
  });
});
