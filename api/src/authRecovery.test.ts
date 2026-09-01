import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import type express from "express";
import supertest from "supertest";

import {MAX_PASSWORD_LENGTH} from "./auth";
import {AuthToken} from "./authTokens";
import {TerrenoApp} from "./terrenoApp";
import {setupDb, UserModel} from "./tests";

interface CapturedMail {
  html?: string;
  subject: string;
  text: string;
  to: string;
}

const tokenFromResetUrl = (text: string): string => {
  const match = text.match(/token=([0-9a-f]+)/i);
  assert.isNotNull(match);
  return match?.[1] ?? "";
};

describe("password reset routes", () => {
  let app: express.Application;
  let sentMail: CapturedMail[];

  beforeEach(async () => {
    await setupDb();
    await AuthToken.deleteMany({});
    sentMail = [];

    app = new TerrenoApp({
      authOptions: {
        publicAppUrl: "https://app.example.com",
        sendMail: async (message) => {
          sentMail.push(message);
        },
      },
      skipListen: true,
      userModel: UserModel,
    }).build();
  });

  it("returns 202 for existing and missing emails and only mails existing users", async () => {
    const existing = await supertest(app)
      .post("/auth/forgotPassword")
      .send({email: "notAdmin@example.com"})
      .expect(202);
    const missing = await supertest(app)
      .post("/auth/forgotPassword")
      .send({email: "nobody@example.com"})
      .expect(202);

    assert.deepEqual(existing.body, missing.body);
    assert.equal(sentMail.length, 1);
    assert.equal(sentMail[0]?.to, "notAdmin@example.com");
    assert.include(sentMail[0]?.text ?? "", "https://app.example.com/resetPassword?token=");
  });

  it("resets the password once, then rejects the token and old refresh tokens", async () => {
    const login = await supertest(app)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(200);
    const oldRefresh = login.body.data.refreshToken as string;

    await supertest(app)
      .post("/auth/forgotPassword")
      .send({email: "notAdmin@example.com"})
      .expect(202);
    const token = tokenFromResetUrl(sentMail[0]?.text ?? "");

    const reset = await supertest(app)
      .post("/auth/resetPassword")
      .send({password: "new-password-123", token})
      .expect(200);
    assert.isString(reset.body.data.token);

    await supertest(app)
      .post("/auth/resetPassword")
      .send({password: "another-password", token})
      .expect(400);

    await supertest(app)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(401);
    await supertest(app)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "new-password-123"})
      .expect(200);

    const refresh = await supertest(app)
      .post("/auth/refresh_token")
      .send({refreshToken: oldRefresh})
      .expect(401);
    assert.equal(refresh.body.message, "Invalid refresh token");
  });

  it("honors the RTK client POST /resetPassword path and body shape", async () => {
    await supertest(app)
      .post("/auth/forgotPassword")
      .send({email: "notAdmin@example.com"})
      .expect(202);
    const token = tokenFromResetUrl(sentMail[0]?.text ?? "");

    await supertest(app)
      .post("/resetPassword")
      .send({
        _id: "unused",
        email: "notAdmin@example.com",
        newPassword: "rtk-new-password",
        oldPassword: "password",
        password: "rtk-new-password",
        token,
      })
      .expect(200);

    await supertest(app)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "rtk-new-password"})
      .expect(200);
  });

  it("does not consume a reset token when the new password is too long", async () => {
    await supertest(app)
      .post("/auth/forgotPassword")
      .send({email: "notAdmin@example.com"})
      .expect(202);
    const token = tokenFromResetUrl(sentMail[0]?.text ?? "");

    await supertest(app)
      .post("/auth/resetPassword")
      .send({password: "x".repeat(MAX_PASSWORD_LENGTH + 1), token})
      .expect(400);

    await supertest(app)
      .post("/auth/resetPassword")
      .send({password: "valid-after-too-long", token})
      .expect(200);
  });
});
