import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import type {Application} from "express";
import mongoose from "mongoose";
import supertest from "supertest";

import type {UserModel as AuthUserModel} from "../../auth";
import {TerrenoApp} from "../../terrenoApp";
import {setupTestData, UserModel} from "../../tests";
import {hmacSignature} from "../verifiers/hmac";
import {WebhooksApp} from "../webhooksApp";
import {createMongoIdempotencyStore} from "./mongoStore";
import {
  DEFAULT_WEBHOOK_RECEIPT_TTL_DAYS,
  getWebhookReceiptModel,
  WEBHOOK_RECEIPTS_COLLECTION,
} from "./webhookReceipt";

const WEBHOOK_SECRET = "whsec_test";
const FIXTURE_BODY = `{"id":"evt_1"}`;
const FIXTURE_HMAC_HEX = "030fa3b2413d1993c551364bd53bb9b3edb5c0c34d55dba6ada6041245632811";

const buildApp = ({
  handler,
  source = "example",
}: {
  handler: () => void;
  source?: string;
}): Application => {
  const webhooks = new WebhooksApp({idempotency: {store: "mongo"}});
  webhooks.route({
    eventId: (req) => String((req.body as {id?: string})?.id ?? ""),
    handler,
    path: "/webhooks/example",
    source,
    verify: hmacSignature({header: "X-Webhook-Signature", secret: WEBHOOK_SECRET}),
  });
  return new TerrenoApp({
    logRequests: false,
    skipListen: true,
    userModel: UserModel as unknown as AuthUserModel,
  })
    .register(webhooks)
    .build();
};

describe("mongo webhook idempotency store", () => {
  beforeEach(async () => {
    await setupTestData();
    await getWebhookReceiptModel().deleteMany({});
    await getWebhookReceiptModel().syncIndexes();
  });

  it("returns duplicate: true for the same source and eventId without a second handler call", async () => {
    let handlerCalls = 0;
    const app = buildApp({
      handler: () => {
        handlerCalls += 1;
      },
    });

    const first = await supertest(app)
      .post("/webhooks/example")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", FIXTURE_HMAC_HEX)
      .send(FIXTURE_BODY);
    const second = await supertest(app)
      .post("/webhooks/example")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", FIXTURE_HMAC_HEX)
      .send(FIXTURE_BODY);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);
    assert.equal(handlerCalls, 1);
  });

  it("lets two sources share the same event id string", async () => {
    const webhooks = new WebhooksApp({idempotency: {store: "mongo"}});
    let stripeCalls = 0;
    let twilioCalls = 0;
    webhooks.route({
      eventId: () => "shared-id",
      handler: () => {
        stripeCalls += 1;
      },
      path: "/webhooks/stripe",
      source: "stripe",
      verify: () => true,
    });
    webhooks.route({
      eventId: () => "shared-id",
      handler: () => {
        twilioCalls += 1;
      },
      path: "/webhooks/twilio",
      source: "twilio",
      verify: () => true,
    });
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: UserModel as unknown as AuthUserModel,
    })
      .register(webhooks)
      .build();

    const stripeRes = await supertest(app)
      .post("/webhooks/stripe")
      .set("Content-Type", "application/json")
      .send(`{"id":"shared-id"}`);
    const twilioRes = await supertest(app)
      .post("/webhooks/twilio")
      .set("Content-Type", "application/json")
      .send(`{"id":"shared-id"}`);

    assert.equal(stripeRes.status, 200);
    assert.equal(twilioRes.status, 200);
    assert.equal(stripeCalls, 1);
    assert.equal(twilioCalls, 1);
  });

  it("releases the mongo claim when the handler throws", async () => {
    let handlerCalls = 0;
    const app = buildApp({
      handler: () => {
        handlerCalls += 1;
        if (handlerCalls === 1) {
          throw new Error("mongo handler exploded");
        }
      },
    });

    const failed = await supertest(app)
      .post("/webhooks/example")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", FIXTURE_HMAC_HEX)
      .send(FIXTURE_BODY);
    const retried = await supertest(app)
      .post("/webhooks/example")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", FIXTURE_HMAC_HEX)
      .send(FIXTURE_BODY);

    assert.equal(failed.status, 500);
    assert.equal(retried.status, 200);
    assert.equal(handlerCalls, 2);
  });

  it("creates a unique compound index and a TTL index on created", async () => {
    await getWebhookReceiptModel().create({eventId: "idx", source: "example"});
    const db = mongoose.connection.db;
    assert.ok(db);
    const indexes = await db.collection(WEBHOOK_RECEIPTS_COLLECTION).indexes();
    const unique = indexes.find((index) => {
      return Boolean(index.unique && index.key.source === 1 && index.key.eventId === 1);
    });
    const ttl = indexes.find((index) => index.key.created === 1);
    assert.ok(unique);
    assert.ok(ttl);
    assert.equal(ttl.expireAfterSeconds, DEFAULT_WEBHOOK_RECEIPT_TTL_DAYS * 86_400);
  });

  it("does not expose webhookReceipts on a modelRouter path", async () => {
    const app = buildApp({handler: () => undefined});
    const spec = await supertest(app).get("/openapi.json").expect(200);
    const paths = spec.body.paths as Record<string, unknown>;
    assert.isUndefined(paths["/webhookReceipts"]);
    assert.isUndefined(paths["/webhook-receipts"]);
  });

  it("retries index sync after a transient failure", async () => {
    const model = getWebhookReceiptModel();
    const originalSync = model.syncIndexes.bind(model);
    let syncCalls = 0;
    model.syncIndexes = (async () => {
      syncCalls += 1;
      if (syncCalls === 1) {
        throw new Error("index sync failed");
      }
      return originalSync();
    }) as typeof model.syncIndexes;
    const store = createMongoIdempotencyStore();
    try {
      let firstFailed = false;
      try {
        await store.claim({eventId: "retry-1", source: "example"});
      } catch {
        firstFailed = true;
      }
      assert.isTrue(firstFailed);
      const result = await store.claim({eventId: "retry-1", source: "example"});
      assert.equal(result, "claimed");
      assert.equal(syncCalls, 2);
    } finally {
      model.syncIndexes = originalSync;
    }
  });

  it("rethrows non-duplicate create errors", async () => {
    const store = createMongoIdempotencyStore();
    const model = getWebhookReceiptModel();
    const originalCreate = model.create.bind(model);
    model.create = (async () => {
      throw new Error("write failed");
    }) as typeof model.create;
    try {
      let failed = false;
      try {
        await store.claim({eventId: "write-fail", source: "example"});
      } catch {
        failed = true;
      }
      assert.isTrue(failed);
    } finally {
      model.create = originalCreate;
    }
  });

  it("applies idempotency.ttlDays to the created TTL index", async () => {
    const webhooks = new WebhooksApp({idempotency: {store: "mongo", ttlDays: 1}});
    webhooks.route({
      eventId: () => "ttl-custom",
      handler: () => undefined,
      path: "/webhooks/ttl",
      source: "example",
      verify: () => true,
    });
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: UserModel as unknown as AuthUserModel,
    })
      .register(webhooks)
      .build();
    await supertest(app).post("/webhooks/ttl").set("Content-Type", "application/json").send("{}");
    const db = mongoose.connection.db;
    assert.ok(db);
    const indexes = await db.collection(WEBHOOK_RECEIPTS_COLLECTION).indexes();
    const ttl = indexes.find((index) => index.key.created === 1);
    assert.ok(ttl);
    assert.equal(ttl.expireAfterSeconds, 86_400);
  });

  it("throws when ttlDays is not a positive number", (): void => {
    let failed = false;
    try {
      createMongoIdempotencyStore({ttlDays: 0});
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
  });

  it("throws when mongoose is not connected", async () => {
    const store = createMongoIdempotencyStore();
    const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, "db");
    Object.defineProperty(mongoose.connection, "db", {configurable: true, value: undefined});
    try {
      let failed = false;
      try {
        await store.claim({eventId: "offline", source: "example"});
      } catch {
        failed = true;
      }
      assert.isTrue(failed);
    } finally {
      if (descriptor) {
        Object.defineProperty(mongoose.connection, "db", descriptor);
      }
    }
  });
});
