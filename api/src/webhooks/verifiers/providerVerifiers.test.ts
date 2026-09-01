import {describe, it} from "bun:test";
import crypto from "node:crypto";
import {assert} from "chai";
import type {Application, Request} from "express";
import {DateTime} from "luxon";
import supertest from "supertest";

import type {UserModel as AuthUserModel} from "../../auth";
import {TerrenoApp} from "../../terrenoApp";
import {UserModel} from "../../tests";
import {WebhooksApp} from "../webhooksApp";
import {sendgridEventSignature} from "./sendgrid";
import {stripeSignature} from "./stripe";
import {twilioSignature} from "./twilio";

const STRIPE_SECRET = "whsec_stripe_test";
const STRIPE_BODY = `{"id":"evt_stripe_1"}`;
const TWILIO_TOKEN = "twilio_auth_token";
const TWILIO_URL = "https://api.example.com/comms/webhooks/twilio/status";
const TWILIO_BODY = "MessageSid=SM123&MessageStatus=delivered";

const buildApp = ({
  path,
  source,
  verify,
}: {
  path: string;
  source: string;
  verify: (req: Request) => boolean;
}): Application => {
  const webhooks = new WebhooksApp({idempotency: {store: "memory"}});
  webhooks.route({
    eventId: () => "evt",
    handler: () => undefined,
    path,
    source,
    verify,
  });
  return new TerrenoApp({
    logRequests: false,
    skipListen: true,
    userModel: UserModel as unknown as AuthUserModel,
  })
    .register(webhooks)
    .build();
};

const stripeHeader = ({payload, timestamp}: {payload: string; timestamp: number}): string => {
  const v1 = crypto
    .createHmac("sha256", STRIPE_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${v1}`;
};

const twilioHeader = ({body, url}: {body: string; url: string}): string => {
  const params = Object.fromEntries(new URLSearchParams(body));
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) {
    data += key + params[key];
  }
  return crypto.createHmac("sha1", TWILIO_TOKEN).update(data, "utf8").digest("base64");
};

describe("stripeSignature", () => {
  it("accepts a fixture inside the timestamp window", async () => {
    const app = buildApp({
      path: "/billing/webhooks/stripe",
      source: "stripe",
      verify: stripeSignature({secret: STRIPE_SECRET}),
    });
    const timestamp = DateTime.utc().toUnixInteger();
    const res = await supertest(app)
      .post("/billing/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", stripeHeader({payload: STRIPE_BODY, timestamp}))
      .send(STRIPE_BODY);

    assert.equal(res.status, 200);
  });

  it("rejects a timestamp outside the tolerance window", async () => {
    const app = buildApp({
      path: "/billing/webhooks/stripe",
      source: "stripe",
      verify: stripeSignature({secret: STRIPE_SECRET, toleranceSec: 300}),
    });
    const timestamp = DateTime.utc().toUnixInteger() - 301;
    const res = await supertest(app)
      .post("/billing/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", stripeHeader({payload: STRIPE_BODY, timestamp}))
      .send(STRIPE_BODY);

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "webhook-signature-invalid");
  });

  it("rejects a mutated payload", async () => {
    const app = buildApp({
      path: "/billing/webhooks/stripe",
      source: "stripe",
      verify: stripeSignature({secret: STRIPE_SECRET}),
    });
    const timestamp = DateTime.utc().toUnixInteger();
    const res = await supertest(app)
      .post("/billing/webhooks/stripe")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", stripeHeader({payload: STRIPE_BODY, timestamp}))
      .send(`{"id":"evt_mutated"}`);

    assert.equal(res.status, 401);
  });
});

describe("twilioSignature", () => {
  it("accepts a form-urlencoded fixture", async () => {
    const app = buildApp({
      path: "/comms/webhooks/twilio/status",
      source: "twilio",
      verify: twilioSignature({authToken: TWILIO_TOKEN, url: TWILIO_URL}),
    });
    const res = await supertest(app)
      .post("/comms/webhooks/twilio/status")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("X-Twilio-Signature", twilioHeader({body: TWILIO_BODY, url: TWILIO_URL}))
      .send(TWILIO_BODY);

    assert.equal(res.status, 200);
  });

  it("rejects JSON on the Twilio route", async () => {
    const app = buildApp({
      path: "/comms/webhooks/twilio/status",
      source: "twilio",
      verify: twilioSignature({authToken: TWILIO_TOKEN, url: TWILIO_URL}),
    });
    const jsonBody = `{"MessageSid":"SM123","MessageStatus":"delivered"}`;
    const res = await supertest(app)
      .post("/comms/webhooks/twilio/status")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Signature", twilioHeader({body: TWILIO_BODY, url: TWILIO_URL}))
      .send(jsonBody);

    assert.equal(res.status, 401);
  });

  it("rejects a mutated form body", async () => {
    const app = buildApp({
      path: "/comms/webhooks/twilio/status",
      source: "twilio",
      verify: twilioSignature({authToken: TWILIO_TOKEN, url: TWILIO_URL}),
    });
    const res = await supertest(app)
      .post("/comms/webhooks/twilio/status")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .set("X-Twilio-Signature", twilioHeader({body: TWILIO_BODY, url: TWILIO_URL}))
      .send("MessageSid=SM123&MessageStatus=failed");

    assert.equal(res.status, 401);
  });
});

describe("sendgridEventSignature", () => {
  it("accepts an ECDSA fixture and rejects a mutated payload", async () => {
    const {publicKey, privateKey} = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const pem = publicKey.export({format: "pem", type: "spki"}).toString();
    const app = buildApp({
      path: "/comms/webhooks/sendgrid",
      source: "sendgrid",
      verify: sendgridEventSignature({publicKey: pem}),
    });
    const payload = `[{"sg_event_id":"sg_1","event":"delivered"}]`;
    const timestamp = String(DateTime.utc().toUnixInteger());
    const signer = crypto.createSign("SHA256");
    signer.update(timestamp);
    signer.update(payload);
    signer.end();
    const signature = signer.sign(privateKey, "base64");

    const accepted = await supertest(app)
      .post("/comms/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Email-Event-Webhook-Timestamp", timestamp)
      .set("X-Twilio-Email-Event-Webhook-Signature", signature)
      .send(payload);
    assert.equal(accepted.status, 200);

    const rejected = await supertest(app)
      .post("/comms/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Email-Event-Webhook-Timestamp", timestamp)
      .set("X-Twilio-Email-Event-Webhook-Signature", signature)
      .send(`[{"sg_event_id":"sg_1","event":"bounce"}]`);
    assert.equal(rejected.status, 401);
  });

  it("accepts a raw public key without PEM headers", async () => {
    const {publicKey, privateKey} = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const raw = publicKey
      .export({format: "pem", type: "spki"})
      .toString()
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s+/g, "");
    const app = buildApp({
      path: "/comms/webhooks/sendgrid",
      source: "sendgrid",
      verify: sendgridEventSignature({publicKey: raw}),
    });
    const payload = `[{"sg_event_id":"sg_raw","event":"delivered"}]`;
    const timestamp = String(DateTime.utc().toUnixInteger());
    const signer = crypto.createSign("SHA256");
    signer.update(timestamp);
    signer.update(payload);
    signer.end();
    const signature = signer.sign(privateKey, "base64");
    const res = await supertest(app)
      .post("/comms/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Email-Event-Webhook-Timestamp", timestamp)
      .set("X-Twilio-Email-Event-Webhook-Signature", signature)
      .send(payload);
    assert.equal(res.status, 200);
  });

  it("rejects a missing timestamp header", async () => {
    const {publicKey} = crypto.generateKeyPairSync("ec", {namedCurve: "prime256v1"});
    const pem = publicKey.export({format: "pem", type: "spki"}).toString();
    const app = buildApp({
      path: "/comms/webhooks/sendgrid",
      source: "sendgrid",
      verify: sendgridEventSignature({publicKey: pem}),
    });
    const res = await supertest(app)
      .post("/comms/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Email-Event-Webhook-Signature", "sig")
      .send(`[{"sg_event_id":"sg_1","event":"delivered"}]`);
    assert.equal(res.status, 401);
  });

  it("rejects a missing signature header", async () => {
    const {publicKey} = crypto.generateKeyPairSync("ec", {namedCurve: "prime256v1"});
    const pem = publicKey.export({format: "pem", type: "spki"}).toString();
    const app = buildApp({
      path: "/comms/webhooks/sendgrid",
      source: "sendgrid",
      verify: sendgridEventSignature({publicKey: pem}),
    });
    const res = await supertest(app)
      .post("/comms/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Email-Event-Webhook-Timestamp", "1")
      .send(`[{"sg_event_id":"sg_1","event":"delivered"}]`);
    assert.equal(res.status, 401);
  });

  it("rejects an invalid public key", async () => {
    const app = buildApp({
      path: "/comms/webhooks/sendgrid",
      source: "sendgrid",
      verify: sendgridEventSignature({publicKey: "not-a-key"}),
    });
    const res = await supertest(app)
      .post("/comms/webhooks/sendgrid")
      .set("Content-Type", "application/json")
      .set("X-Twilio-Email-Event-Webhook-Timestamp", "1")
      .set("X-Twilio-Email-Event-Webhook-Signature", "AAAA")
      .send(`[{"sg_event_id":"sg_1","event":"delivered"}]`);
    assert.equal(res.status, 401);
  });
});
