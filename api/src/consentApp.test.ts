import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import {ConsentApp} from "./consentApp";
import {ConsentForm} from "./models/consentForm";
import {ConsentResponse} from "./models/consentResponse";
import {TerrenoApp} from "./terrenoApp";
import {authAsUser, setupDb, UserModel} from "./tests";

function buildApp(consentAppOptions = {}): express.Application {
  return new TerrenoApp({
    skipListen: true,
    userModel: UserModel as any,
  })
    .register(new ConsentApp(consentAppOptions))
    .build();
}

describe("ConsentApp", () => {
  let admin: any;
  let notAdmin: any;
  let adminAgent: TestAgent;
  let userAgent: TestAgent;

  beforeEach(async () => {
    [admin, notAdmin] = await setupDb();
    await Promise.all([ConsentForm.deleteMany({}), ConsentResponse.deleteMany({})]);
    const app = buildApp({auditTrail: true});
    adminAgent = await authAsUser(app, "admin");
    userAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await Promise.all([ConsentForm.deleteMany({}), ConsentResponse.deleteMany({})]);
  });

  describe("GET /consent-forms (admin CRUD)", () => {
    it("returns empty list when no forms exist", async () => {
      const res = await adminAgent.get("/consent-forms").expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("lists consent forms for admins", async () => {
      await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms\nPlease agree."]]),
        order: 1,
        slug: "terms",
        title: "Terms of Service",
        type: "terms",
        version: 1,
      });

      const res = await adminAgent.get("/consent-forms").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Terms of Service");
    });

    it("blocks non-admins from listing forms", async () => {
      await userAgent.get("/consent-forms").expect(405);
    });

    it("creates a consent form as admin", async () => {
      const res = await adminAgent
        .post("/consent-forms")
        .send({
          active: false,
          content: {en: "# Privacy\nWe protect your data."},
          order: 2,
          slug: "privacy",
          title: "Privacy Policy",
          type: "privacy",
          version: 1,
        })
        .expect(201);

      expect(res.body.data.title).toBe("Privacy Policy");
      expect(res.body.data.slug).toBe("privacy");
    });

    it("updates a consent form as admin", async () => {
      const form = await ConsentForm.create({
        active: false,
        content: new Map([["en", "# HIPAA"]]),
        order: 3,
        slug: "hipaa",
        title: "HIPAA Notice",
        type: "hipaa",
        version: 1,
      });

      const res = await adminAgent
        .patch(`/consent-forms/${form._id}`)
        .send({title: "HIPAA Authorization"})
        .expect(200);

      expect(res.body.data.title).toBe("HIPAA Authorization");
    });
  });

  describe("POST /consent-forms/:id/publish", () => {
    it("creates a new version and activates it", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms v1"]]),
        order: 1,
        slug: "terms-publish",
        title: "Terms v1",
        type: "terms",
        version: 1,
      });

      const res = await adminAgent.post(`/consent-forms/${form._id}/publish`).expect(200);

      expect(res.body.data.version).toBe(2);
      expect(res.body.data.active).toBe(true);
      expect(res.body.data.slug).toBe("terms-publish");

      // Old form should be deactivated
      const oldForm = await ConsentForm.findById(form._id);
      expect(oldForm?.active).toBe(false);
    });

    it("increments version number correctly", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Content"]]),
        order: 1,
        slug: "versioned",
        title: "Versioned Form",
        type: "agreement",
        version: 3,
      });

      const res = await adminAgent.post(`/consent-forms/${form._id}/publish`).expect(200);

      expect(res.body.data.version).toBe(4);
    });

    it("requires admin to publish", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms"]]),
        order: 1,
        slug: "terms-nonadmin",
        title: "Terms",
        type: "terms",
        version: 1,
      });

      await userAgent.post(`/consent-forms/${form._id}/publish`).expect(403);
    });
  });

  describe("GET /consent-responses (admin read-only)", () => {
    it("returns empty list when no responses", async () => {
      const res = await adminAgent.get("/consent-responses").expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("lists responses for admins", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms"]]),
        order: 1,
        slug: "terms-resp",
        title: "Terms",
        type: "terms",
        version: 1,
      });

      await ConsentResponse.create({
        agreed: true,
        agreedAt: new Date(),
        consentFormId: form._id,
        formVersionSnapshot: 1,
        locale: "en",
        userId: notAdmin._id,
      });

      const res = await adminAgent.get("/consent-responses").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].agreed).toBe(true);
    });

    it("blocks non-admins from listing responses", async () => {
      await userAgent.get("/consent-responses").expect(405);
    });

    it("blocks create on consent-responses", async () => {
      await adminAgent.post("/consent-responses").send({}).expect(405);
    });
  });

  describe("GET /consents/pending", () => {
    it("returns empty array when no active forms", async () => {
      const res = await userAgent.get("/consents/pending").expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("returns active forms the user hasn't responded to", async () => {
      await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms"]]),
        order: 1,
        slug: "pending-terms",
        title: "Terms",
        type: "terms",
        version: 1,
      });

      const res = await userAgent.get("/consents/pending").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe("Terms");
    });

    it("excludes forms the user has already responded to at the current version", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms"]]),
        order: 1,
        slug: "responded-terms",
        title: "Terms",
        type: "terms",
        version: 1,
      });

      await ConsentResponse.create({
        agreed: true,
        agreedAt: new Date(),
        consentFormId: form._id,
        formVersionSnapshot: 1,
        locale: "en",
        userId: notAdmin._id,
      });

      const res = await userAgent.get("/consents/pending").expect(200);
      expect(res.body.data).toHaveLength(0);
    });

    it("includes forms when the user responded to an older version", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms v2"]]),
        order: 1,
        slug: "updated-terms",
        title: "Terms",
        type: "terms",
        version: 2,
      });

      // User responded to version 1
      await ConsentResponse.create({
        agreed: true,
        agreedAt: new Date(),
        consentFormId: form._id,
        formVersionSnapshot: 1,
        locale: "en",
        userId: notAdmin._id,
      });

      const res = await userAgent.get("/consents/pending").expect(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("returns forms sorted by order field", async () => {
      await Promise.all([
        ConsentForm.create({
          active: true,
          content: new Map([["en", "# Second"]]),
          order: 2,
          slug: "second-form",
          title: "Second Form",
          type: "privacy",
          version: 1,
        }),
        ConsentForm.create({
          active: true,
          content: new Map([["en", "# First"]]),
          order: 1,
          slug: "first-form",
          title: "First Form",
          type: "terms",
          version: 1,
        }),
      ]);

      const res = await userAgent.get("/consents/pending").expect(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].title).toBe("First Form");
      expect(res.body.data[1].title).toBe("Second Form");
    });

    it("applies resolveConsentForms callback to filter forms", async () => {
      await Promise.all([
        ConsentForm.create({
          active: true,
          content: new Map([["en", "# Privacy"]]),
          order: 1,
          slug: "resolver-privacy",
          title: "Privacy",
          type: "privacy",
          version: 1,
        }),
        ConsentForm.create({
          active: true,
          content: new Map([["en", "# Terms"]]),
          order: 2,
          slug: "resolver-terms",
          title: "Terms",
          type: "terms",
          version: 1,
        }),
      ]);

      // Build app with resolver that only returns privacy forms
      const filteredApp = buildApp({
        resolveConsentForms: (_user: any, forms: any[]) =>
          forms.filter((f) => f.type === "privacy"),
      });
      const filteredAgent = await authAsUser(filteredApp, "notAdmin");

      const res = await filteredAgent.get("/consents/pending").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe("privacy");
    });

    it("requires authentication", async () => {
      const app = buildApp();
      await supertest(app).get("/consents/pending").expect(401);
    });
  });

  describe("POST /consents/respond", () => {
    let form: any;

    beforeEach(async () => {
      form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Terms"]]),
        order: 1,
        slug: "respond-terms",
        title: "Terms",
        type: "terms",
        version: 1,
      });
    });

    it("creates a consent response", async () => {
      const res = await userAgent
        .post("/consents/respond")
        .send({
          agreed: true,
          consentFormId: form._id,
          locale: "en",
        })
        .expect(200);

      expect(res.body.data.agreed).toBe(true);
      expect(res.body.data.locale).toBe("en");
    });

    it("returns 400 when consentFormId is missing", async () => {
      await userAgent.post("/consents/respond").send({agreed: true, locale: "en"}).expect(400);
    });

    it("returns 400 when agreed field is missing", async () => {
      await userAgent
        .post("/consents/respond")
        .send({consentFormId: form._id, locale: "en"})
        .expect(400);
    });

    it("returns 400 when locale is missing", async () => {
      await userAgent
        .post("/consents/respond")
        .send({agreed: true, consentFormId: form._id})
        .expect(400);
    });

    it("returns 400 when form is not active", async () => {
      const inactiveForm = await ConsentForm.create({
        active: false,
        content: new Map([["en", "# Inactive"]]),
        order: 5,
        slug: "inactive-form",
        title: "Inactive Form",
        type: "custom",
        version: 1,
      });

      await userAgent
        .post("/consents/respond")
        .send({agreed: true, consentFormId: inactiveForm._id, locale: "en"})
        .expect(400);
    });

    it("validates required checkboxes when agreed is true", async () => {
      const formWithRequired = await ConsentForm.create({
        active: true,
        checkboxes: [{label: "I confirm", required: true}],
        content: new Map([["en", "# Required Checkbox Form"]]),
        order: 6,
        slug: "required-checkbox-form",
        title: "Required Checkbox Form",
        type: "agreement",
        version: 1,
      });

      // Agree without checking the required checkbox
      await userAgent
        .post("/consents/respond")
        .send({
          agreed: true,
          checkboxValues: {"0": false},
          consentFormId: formWithRequired._id,
          locale: "en",
        })
        .expect(400);

      // Agree with the required checkbox checked
      const res = await userAgent
        .post("/consents/respond")
        .send({
          agreed: true,
          checkboxValues: {"0": true},
          consentFormId: formWithRequired._id,
          locale: "en",
        })
        .expect(200);

      expect(res.body.data.agreed).toBe(true);
    });

    it("requires signature when captureSignature is true and agreed is true", async () => {
      const sigForm = await ConsentForm.create({
        active: true,
        captureSignature: true,
        content: new Map([["en", "# Signature Required"]]),
        order: 7,
        slug: "sig-form",
        title: "Signature Form",
        type: "agreement",
        version: 1,
      });

      await userAgent
        .post("/consents/respond")
        .send({agreed: true, consentFormId: sigForm._id, locale: "en"})
        .expect(400);

      const res = await userAgent
        .post("/consents/respond")
        .send({
          agreed: true,
          consentFormId: sigForm._id,
          locale: "en",
          signature: "data:image/png;base64,abc123",
        })
        .expect(200);

      expect(res.body.data.signature).toBe("data:image/png;base64,abc123");
    });

    it("stores formVersionSnapshot always", async () => {
      const res = await userAgent
        .post("/consents/respond")
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(200);

      expect(res.body.data.formVersionSnapshot).toBe(1);
    });

    it("stores audit trail fields when auditTrail is enabled", async () => {
      const res = await userAgent
        .post("/consents/respond")
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(200);

      expect(res.body.data.contentSnapshot).toBeDefined();
      expect(res.body.data.contentSnapshot).toContain("Terms");
    });

    it("requires authentication", async () => {
      const app = buildApp();
      await supertest(app)
        .post("/consents/respond")
        .send({agreed: true, consentFormId: form._id, locale: "en"})
        .expect(401);
    });
  });

  describe("GET /consents/audit/:userId", () => {
    it("returns audit history for a user when auditTrail is enabled", async () => {
      const form = await ConsentForm.create({
        active: true,
        content: new Map([["en", "# Audit Terms"]]),
        order: 1,
        slug: "audit-terms",
        title: "Audit Terms",
        type: "terms",
        version: 1,
      });

      await ConsentResponse.create({
        agreed: true,
        agreedAt: new Date(),
        consentFormId: form._id,
        contentSnapshot: "# Audit Terms",
        formVersionSnapshot: 1,
        locale: "en",
        userId: notAdmin._id,
      });

      const res = await adminAgent.get(`/consents/audit/${notAdmin._id}`).expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].agreed).toBe(true);
      expect(res.body.data[0].form.title).toBe("Audit Terms");
    });

    it("returns 403 for non-admin users", async () => {
      await userAgent.get(`/consents/audit/${notAdmin._id}`).expect(403);
    });

    it("returns 404 when auditTrail is disabled", async () => {
      const noAuditApp = buildApp({auditTrail: false});
      const noAuditAdmin = await authAsUser(noAuditApp, "admin");
      await noAuditAdmin.get(`/consents/audit/${notAdmin._id}`).expect(404);
    });
  });
});
