import {describe, it} from "bun:test";
import {assert} from "chai";
import type {Application, Request} from "express";
import supertest from "supertest";

import type {UserModel as AuthUserModel} from "../auth";
import {TerrenoApp} from "../terrenoApp";
import {UserModel} from "../tests";

const buildEchoApp = (): Application => {
  return new TerrenoApp({
    configureApp: (app) => {
      app.post("/__raw-body-echo", (req: Request, res) => {
        if (req.body && typeof req.body === "object") {
          (req.body as {mutated?: boolean}).mutated = true;
        }
        const rawBody = req.rawBody;
        res.json({
          body: req.body,
          rawBodyUtf8: rawBody ? rawBody.toString("utf8") : null,
        });
      });
    },
    logRequests: false,
    skipListen: true,
    userModel: UserModel as unknown as AuthUserModel,
  }).build();
};

describe("TerrenoApp raw body capture", () => {
  it("stores JSON request bytes on req.rawBody and still parses req.body", async () => {
    const app = buildEchoApp();
    const payload = `{"hello":"world"}`;

    const res = await supertest(app)
      .post("/__raw-body-echo")
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(200);

    assert.strictEqual(res.body.rawBodyUtf8, payload);
    assert.strictEqual(res.body.body.hello, "world");
  });

  it("does not change rawBody when the parsed JSON object is mutated", async () => {
    const app = buildEchoApp();
    const payload = `{"hello":"world"}`;

    const res = await supertest(app)
      .post("/__raw-body-echo")
      .set("Content-Type", "application/json")
      .send(payload)
      .expect(200);

    assert.strictEqual(res.body.body.mutated, true);
    assert.strictEqual(res.body.rawBodyUtf8, payload);
    assert.notInclude(res.body.rawBodyUtf8, "mutated");
  });

  it("stores urlencoded request bytes on req.rawBody", async () => {
    const app = buildEchoApp();
    const payload = "MessageSid=SM123&MessageStatus=delivered";

    const res = await supertest(app)
      .post("/__raw-body-echo")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(payload)
      .expect(200);

    assert.strictEqual(res.body.rawBodyUtf8, payload);
    assert.strictEqual(res.body.body.MessageSid, "SM123");
    assert.strictEqual(res.body.body.MessageStatus, "delivered");
  });
});
