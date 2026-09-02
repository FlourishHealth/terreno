import {describe, it} from "bun:test";
import {assert} from "chai";
import type {Application, Request} from "express";
import supertest from "supertest";

import type {UserModel as AuthUserModel} from "../auth";
import {TerrenoApp} from "../terrenoApp";
import {UserModel} from "../tests";
import {hmacSignature} from "./verifiers/hmac";
import {WebhooksApp} from "./webhooksApp";

const WEBHOOK_SECRET = "whsec_test";
const FIXTURE_BODY = `{"id":"evt_1"}`;
/** openssl dgst -sha256 -hmac whsec_test of {"id":"evt_1"} */
const FIXTURE_HMAC_HEX = "030fa3b2413d1993c551364bd53bb9b3edb5c0c34d55dba6ada6041245632811";
const SPACED_BODY = `{"id": "evt_1"}`;
/** HMAC of JSON.stringify({id:"evt_1"}) which is FIXTURE_BODY, not SPACED_BODY */
const STRINGIFY_HMAC_HEX = FIXTURE_HMAC_HEX;
/** openssl dgst -sha256 -hmac whsec_test of {"id": "evt_1"} */
const SPACED_HMAC_HEX = "13b1c709ea677bd832fb32f71b5ab6e9fbb22ead444bc5471aff93caffeb5042";

const buildWebhookApp = ({
  eventId,
  handler,
}: {
  eventId?: (req: Request) => string;
  handler: () => Promise<void> | void;
}): {app: Application; webhooks: WebhooksApp} => {
  const webhooks = new WebhooksApp({idempotency: {store: "memory"}});
  webhooks.route({
    eventId: eventId ?? ((req) => String((req.body as {id?: string})?.id ?? "")),
    handler,
    path: "/webhooks/example",
    source: "example",
    verify: hmacSignature({header: "X-Webhook-Signature", secret: WEBHOOK_SECRET}),
  });
  const app = new TerrenoApp({
    logRequests: false,
    skipListen: true,
    userModel: UserModel as unknown as AuthUserModel,
  })
    .register(webhooks)
    .build();
  return {app, webhooks};
};

const postSigned = (
  app: Application,
  {body = FIXTURE_BODY, signature = FIXTURE_HMAC_HEX}: {body?: string; signature?: string} = {}
): Promise<supertest.Response> => {
  const request = supertest(app).post("/webhooks/example").set("Content-Type", "application/json");
  if (signature) {
    request.set("X-Webhook-Signature", signature);
  }
  return request.send(body);
};

describe("WebhooksApp HMAC tracer", () => {
  it("returns 200 and runs the handler once for a valid HMAC", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      handler: () => {
        handlerCalls += 1;
      },
    });

    const res = await postSigned(app);

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    assert.isUndefined(res.body.duplicate);
    assert.equal(handlerCalls, 1);
  });

  it("returns 401 webhook-signature-invalid when the signature header is missing", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      handler: () => {
        handlerCalls += 1;
      },
    });

    const res = await postSigned(app, {signature: ""});

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "webhook-signature-invalid");
    assert.equal(handlerCalls, 0);
  });

  it("returns 401 when the body is tampered after signing", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      handler: () => {
        handlerCalls += 1;
      },
    });

    const res = await postSigned(app, {body: `{"id":"evt_tampered"}`});

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "webhook-signature-invalid");
    assert.equal(handlerCalls, 0);
  });

  it("rejects HMAC computed from JSON.stringify(parsed body) when it differs from raw bytes", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      handler: () => {
        handlerCalls += 1;
      },
    });

    const rejected = await postSigned(app, {
      body: SPACED_BODY,
      signature: STRINGIFY_HMAC_HEX,
    });
    assert.equal(rejected.status, 401);
    assert.equal(handlerCalls, 0);

    const accepted = await postSigned(app, {
      body: SPACED_BODY,
      signature: SPACED_HMAC_HEX,
    });
    assert.equal(accepted.status, 200);
    assert.equal(handlerCalls, 1);
  });

  it("returns duplicate: true on a replayed eventId without a second handler call", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      handler: () => {
        handlerCalls += 1;
      },
    });

    const first = await postSigned(app);
    const second = await postSigned(app);

    assert.equal(first.status, 200);
    assert.isUndefined(first.body.duplicate);
    assert.equal(second.status, 200);
    assert.equal(second.body.received, true);
    assert.equal(second.body.duplicate, true);
    assert.equal(handlerCalls, 1);
  });

  it("releases the claim when the handler throws so a retry succeeds", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      handler: () => {
        handlerCalls += 1;
        if (handlerCalls === 1) {
          throw new Error("handler exploded");
        }
      },
    });

    const failed = await postSigned(app);
    const retried = await postSigned(app);

    assert.equal(failed.status, 500);
    assert.equal(failed.body.title, "Webhook handler failed");
    assert.equal(retried.status, 200);
    assert.equal(retried.body.received, true);
    assert.isUndefined(retried.body.duplicate);
    assert.equal(handlerCalls, 2);
  });

  it("does not list the webhook path in /openapi.json", async () => {
    const {app} = buildWebhookApp({handler: () => undefined});

    const res = await supertest(app).get("/openapi.json").expect(200);
    const paths = res.body.paths as Record<string, unknown> | undefined;
    assert.isUndefined(paths?.["/webhooks/example"]);
  });

  it("skips the idempotency store when eventId is empty and still runs the handler", async () => {
    let handlerCalls = 0;
    const {app} = buildWebhookApp({
      eventId: () => "",
      handler: () => {
        handlerCalls += 1;
      },
    });

    const first = await postSigned(app);
    const second = await postSigned(app);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.isUndefined(second.body.duplicate);
    assert.equal(handlerCalls, 2);
  });

  it("lets a handler claim nested event ids through webhooks.claim", async () => {
    const claims: string[] = [];
    const webhooks = new WebhooksApp({idempotency: {store: "memory"}});
    webhooks.route({
      eventId: () => "",
      handler: async () => {
        const first = await webhooks.claim({eventId: "sg_nested", source: "sendgrid"});
        const second = await webhooks.claim({eventId: "sg_nested", source: "sendgrid"});
        claims.push(first, second);
      },
      path: "/webhooks/example",
      source: "example",
      verify: hmacSignature({header: "X-Webhook-Signature", secret: WEBHOOK_SECRET}),
    });
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: UserModel as unknown as AuthUserModel,
    })
      .register(webhooks)
      .build();

    const res = await postSigned(app);
    assert.equal(res.status, 200);
    assert.deepEqual(claims, ["claimed", "duplicate"]);
  });
});
