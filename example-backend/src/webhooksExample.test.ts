import {beforeEach, describe, it} from "bun:test";
import type {UserModel as AuthUserModel} from "@terreno/api";
import {TerrenoApp} from "@terreno/api";
import {assert} from "chai";
import supertest from "supertest";

import {User} from "./models/user";
import {createExampleInboundWebhooks} from "./webhooksExample";

const FIXTURE_BODY = `{"id":"evt_1"}`;
const FIXTURE_HMAC_HEX = "030fa3b2413d1993c551364bd53bb9b3edb5c0c34d55dba6ada6041245632811";

describe("example HMAC webhook", () => {
  beforeEach(() => {
    Reflect.deleteProperty(process.env, "WEBHOOK_SECRET");
  });

  it("does not register POST /webhooks/example when WEBHOOK_SECRET is unset", async () => {
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: User as unknown as AuthUserModel,
    })
      .register(createExampleInboundWebhooks())
      .build();

    const res = await supertest(app)
      .post("/webhooks/example")
      .set("Content-Type", "application/json")
      .send(FIXTURE_BODY);

    assert.equal(res.status, 404);
  });

  it("accepts a signed POST when WEBHOOK_SECRET is set", async () => {
    process.env.WEBHOOK_SECRET = "whsec_test";
    const app = new TerrenoApp({
      logRequests: false,
      skipListen: true,
      userModel: User as unknown as AuthUserModel,
    })
      .register(createExampleInboundWebhooks())
      .build();

    const res = await supertest(app)
      .post("/webhooks/example")
      .set("Content-Type", "application/json")
      .set("X-Webhook-Signature", FIXTURE_HMAC_HEX)
      .send(FIXTURE_BODY);

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
  });
});
