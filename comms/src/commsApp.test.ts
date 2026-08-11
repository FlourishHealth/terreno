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
import supertest from "supertest";

import {CommsApp, getCommsService} from "./commsApp";
import {CommsMessage} from "./models/commsMessage";
import {PushToken} from "./models/pushToken";

const buildApp = (): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new CommsApp().register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("CommsApp", () => {
  beforeEach(async (): Promise<void> => {
    await setupDb();
    await Promise.all([CommsMessage.deleteMany({}), PushToken.deleteMany({})]);
  });

  it("registers the configured service accessor", (): void => {
    const app = getBaseServer();
    const plugin = new CommsApp({logMessages: false});

    plugin.register(app);

    assert.strictEqual(getCommsService(), plugin.service);
  });

  it("upserts push tokens and isolates list and delete operations by owner", async (): Promise<void> => {
    const app = buildApp();
    const owner = await authAsUser(app, "notAdmin");
    const other = supertest.agent(app);
    const signup = await other
      .post("/auth/signup")
      .send({email: "other@example.com", password: "other-password"})
      .expect(200);
    await other.set("authorization", `Bearer ${signup.body.data.token}`);

    const created = await owner
      .post("/comms/pushTokens")
      .send({deviceId: "device-1", platform: "ios", token: "ExponentPushToken[test]"})
      .expect(201);
    const updated = await owner
      .post("/comms/pushTokens")
      .send({deviceId: "device-1", platform: "android", token: "ExponentPushToken[test]"})
      .expect(200);

    assert.equal(created.body.data._id, updated.body.data._id);
    assert.equal(updated.body.data.platform, "android");
    assert.equal(await PushToken.countDocuments(), 1);

    const ownerList = await owner.get("/comms/pushTokens").expect(200);
    const otherList = await other.get("/comms/pushTokens").expect(200);
    assert.lengthOf(ownerList.body.data, 1);
    assert.lengthOf(otherList.body.data, 0);

    await other.delete(`/comms/pushTokens/${created.body.data._id}`).expect(403);
    await owner.delete(`/comms/pushTokens/${created.body.data._id}`).expect(204);

    const token = await PushToken.findExactlyOne({_id: created.body.data._id});
    assert.isFalse(token.active);
  });

  it("requires authentication for push-token registration", async (): Promise<void> => {
    const app = buildApp();

    await supertest(app)
      .post("/comms/pushTokens")
      .send({platform: "ios", token: "ExponentPushToken[test]"})
      .expect(401);
  });

  it("exposes a paginated, filterable delivery explorer to admins only", async (): Promise<void> => {
    const app = buildApp();
    const admin = await authAsUser(app, "admin");
    const user = await authAsUser(app, "notAdmin");
    await Promise.all([
      CommsMessage.logSend({
        channel: "mail",
        provider: "console",
        status: "sent",
        to: "[redacted]",
      }),
      CommsMessage.logSend({
        channel: "sms",
        provider: "console",
        status: "failed",
        to: "[redacted]",
      }),
    ]);

    await user.get("/comms/messages").expect(403);
    const response = await admin
      .get("/comms/messages")
      .query({channel: "sms", limit: 1, page: 1, status: "failed"})
      .expect(200);

    assert.lengthOf(response.body.data, 1);
    assert.equal(response.body.data[0].channel, "sms");
    assert.equal(response.body.data[0].status, "failed");
    assert.equal(response.body.limit, 1);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.total, 1);
    assert.isFalse(response.body.more);
  });
});
