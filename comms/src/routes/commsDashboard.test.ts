import {beforeEach, describe, it} from "bun:test";
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
import mongoose from "mongoose";
import supertest from "supertest";

import {CommsApp} from "../commsApp";
import {CommsMessage} from "../models/commsMessage";
import type {MailMessage, MailProvider, SendResult} from "../types";

const buildApp = (plugin = new CommsApp()): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  plugin.register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

const seedMessage = async (overrides: Record<string, unknown> = {}): Promise<mongoose.Document> => {
  const created = await CommsMessage.logSend({
    attempts: [
      {
        at: DateTime.utc().toJSDate(),
        provider: "console",
        providerMessageId: "msg-1",
      },
    ],
    channel: "mail",
    payload: {subject: "Welcome", text: "Hello", to: "person@example.com"},
    payloadExpiresAt: DateTime.utc().plus({days: 7}).toJSDate(),
    provider: "console",
    status: "sent",
    subject: "Welcome",
    to: "[redacted]",
    ...overrides,
  });
  if (!created) {
    throw new Error("Failed to seed CommsMessage");
  }
  return created;
};

describe("comms dashboard routes", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await CommsMessage.deleteMany({});
  });

  it("filters list results by provider, error class, error code, template, recipient, and q", async (): Promise<void> => {
    const app = buildApp();
    const admin = await authAsUser(app, "admin");
    const userId = new mongoose.Types.ObjectId();
    await seedMessage({
      error: "mailbox full",
      errorClass: "transient",
      errorCode: "421",
      provider: "sendgrid",
      status: "failed",
      subject: "Invoice 99",
      templateId: "d-invoice",
      to: "****1234",
      userId,
    });
    await seedMessage({
      channel: "sms",
      provider: "twilio",
      status: "sent",
      subject: undefined,
      to: "****9999",
    });

    const byProvider = await admin.get("/comms/messages").query({provider: "sendgrid"}).expect(200);
    assert.lengthOf(byProvider.body.data, 1);
    assert.equal(byProvider.body.data[0].provider, "sendgrid");

    const byErrorClass = await admin
      .get("/comms/messages")
      .query({errorClass: "transient"})
      .expect(200);
    assert.equal(byErrorClass.body.total, 1);

    const byErrorCode = await admin.get("/comms/messages").query({errorCode: "421"}).expect(200);
    assert.equal(byErrorCode.body.total, 1);

    const byTemplate = await admin
      .get("/comms/messages")
      .query({templateId: "d-invoice"})
      .expect(200);
    assert.equal(byTemplate.body.total, 1);

    const byTo = await admin.get("/comms/messages").query({to: "****1234"}).expect(200);
    assert.equal(byTo.body.total, 1);

    const byQ = await admin.get("/comms/messages").query({q: "Invoice"}).expect(200);
    assert.equal(byQ.body.total, 1);
    const byLast4 = await admin.get("/comms/messages").query({q: "1234"}).expect(200);
    assert.equal(byLast4.body.total, 1);
    const byErrorText = await admin.get("/comms/messages").query({q: "mailbox"}).expect(200);
    assert.equal(byErrorText.body.total, 1);
  });

  it("returns message detail with attempts, payload, metadata, and linked retries", async (): Promise<void> => {
    const app = buildApp();
    const admin = await authAsUser(app, "admin");
    const original = await seedMessage({
      metadata: {consoleUrl: "https://sendgrid.example/activity/1"},
      status: "failed",
    });
    const retry = await seedMessage({
      retriedFromId: original._id,
      subject: "Welcome retry",
    });

    const response = await admin.get(`/comms/messages/${String(original._id)}`).expect(200);
    assert.equal(response.body.data.subject, "Welcome");
    assert.deepEqual(response.body.data.payload, {
      subject: "Welcome",
      text: "Hello",
      to: "person@example.com",
    });
    assert.equal(response.body.data.metadata.consoleUrl, "https://sendgrid.example/activity/1");
    assert.lengthOf(response.body.data.attempts, 1);
    assert.equal(response.body.data.retries[0]._id, String(retry._id));
  });

  it("returns 404 for unknown message ids and 403 for non-admins on detail and stats", async (): Promise<void> => {
    const app = buildApp();
    const admin = await authAsUser(app, "admin");
    const user = await authAsUser(app, "notAdmin");
    const missing = "507f1f77bcf86cd799439011";

    await user.get(`/comms/messages/${missing}`).expect(403);
    await user.get("/comms/stats").expect(403);
    await admin.get(`/comms/messages/${missing}`).expect(404);
    await admin.get("/comms/messages/not-an-id").expect(404);
  });
});

describe("comms retry and stats", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await CommsMessage.deleteMany({});
  });

  it("retries a failed mail through the facade and links the new row", async (): Promise<void> => {
    let sent: MailMessage | undefined;
    let sawRetry = false;
    const mail: MailProvider = {
      id: "memory-mail",
      sendMail: async (message: MailMessage): Promise<SendResult> => {
        sent = message;
        return {accepted: true, providerMessageId: "retry-1"};
      },
    };
    const plugin = new CommsApp({
      mail,
      onSend: async (context): Promise<void> => {
        if (context.isRetry) {
          sawRetry = true;
        }
      },
      redactRecipients: false,
    });
    const app = buildApp(plugin);
    const admin = await authAsUser(app, "admin");
    const original = await seedMessage({
      errorClass: "transient",
      status: "failed",
    });

    const response = await admin.post(`/comms/messages/${String(original._id)}/retry`).expect(200);

    assert.equal(sent?.subject, "Welcome");
    assert.equal(sent?.to, "person@example.com");
    assert.equal(response.body.data.retriedFromId, String(original._id));
    assert.isTrue(sawRetry);
    const reloaded = await CommsMessage.findExactlyOne({_id: original._id});
    assert.equal(String(reloaded.retriedById), response.body.data._id);
    assert.match(String(response.body.data.metadata.retriedByUserId), /^[a-f0-9]{24}$/);
  });

  it("returns stable codes for each non-retryable reason", async (): Promise<void> => {
    const plugin = new CommsApp({
      mail: {id: "memory-mail", sendMail: async () => ({accepted: true})},
    });
    const app = buildApp(plugin);
    const admin = await authAsUser(app, "admin");

    const verification = await seedMessage({channel: "verification", status: "failed"});
    const permanent = await seedMessage({errorClass: "permanent", status: "failed"});
    const sent = await seedMessage({status: "sent"});
    const expired = await seedMessage({
      payload: undefined,
      payloadExpiresAt: undefined,
      status: "failed",
    });

    const verificationRes = await admin
      .post(`/comms/messages/${String(verification._id)}/retry`)
      .expect(400);
    assert.equal(verificationRes.body.code, "comms-retry-not-retryable");

    const permanentRes = await admin
      .post(`/comms/messages/${String(permanent._id)}/retry`)
      .expect(400);
    assert.equal(permanentRes.body.code, "comms-retry-not-retryable");

    const sentRes = await admin.post(`/comms/messages/${String(sent._id)}/retry`).expect(400);
    assert.equal(sentRes.body.code, "comms-retry-not-retryable");

    const expiredRes = await admin.post(`/comms/messages/${String(expired._id)}/retry`).expect(400);
    assert.equal(expiredRes.body.code, "comms-retry-payload-expired");
  });

  it("returns comms-retry-channel-unconfigured in production when mail is missing", async (): Promise<void> => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const plugin = new CommsApp({});
      const app = buildApp(plugin);
      const admin = await authAsUser(app, "admin");
      const original = await seedMessage({status: "failed"});
      const response = await admin
        .post(`/comms/messages/${String(original._id)}/retry`)
        .expect(400);
      assert.equal(response.body.code, "comms-retry-channel-unconfigured");
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("retryMany respects the cap and reports skipped reasons", async (): Promise<void> => {
    const mail: MailProvider = {
      id: "memory-mail",
      sendMail: async (): Promise<SendResult> => ({accepted: true, providerMessageId: "ok"}),
    };
    const app = buildApp(new CommsApp({mail}));
    const admin = await authAsUser(app, "admin");
    const failed = await Promise.all([
      seedMessage({status: "failed", subject: "one"}),
      seedMessage({status: "failed", subject: "two"}),
      seedMessage({status: "failed", subject: "three"}),
    ]);
    await seedMessage({errorClass: "permanent", status: "failed", subject: "permanent"});

    const response = await admin
      .post("/comms/messages/retryMany")
      .send({limit: 2, status: "failed"})
      .expect(200);

    assert.equal(response.body.retried.length + response.body.skipped.length, 2);
    assert.isAtMost(response.body.retried.length, 2);
    assert.isAtLeast(response.body.retried.length, 1);
    assert.equal(failed.length, 3);
  });

  it("stats totals match the filtered list for the same range", async (): Promise<void> => {
    const app = buildApp();
    const admin = await authAsUser(app, "admin");
    const startDate = DateTime.utc().minus({hours: 1}).toISO();
    const endDate = DateTime.utc().plus({hours: 1}).toISO();
    await seedMessage({provider: "sendgrid", status: "sent"});
    await seedMessage({provider: "sendgrid", status: "failed"});
    await seedMessage({channel: "sms", provider: "twilio", status: "delivered"});

    const list = await admin.get("/comms/messages").query({endDate, startDate}).expect(200);
    const stats = await admin.get("/comms/stats").query({endDate, startDate}).expect(200);

    assert.equal(stats.body.totals.total, list.body.total);
    assert.equal(
      stats.body.totals.sent + stats.body.totals.failed + stats.body.totals.delivered,
      list.body.total
    );
    const sendgrid = stats.body.byProvider.find(
      (row: {provider: string}) => row.provider === "sendgrid"
    );
    assert.equal(sendgrid.failureRate, 0.5);
  });
});
