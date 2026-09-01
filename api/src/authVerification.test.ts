import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import type express from "express";
import supertest from "supertest";

import {AuthToken} from "./authTokens";
import {TerrenoApp} from "./terrenoApp";
import {setupDb, UserModel} from "./tests";

interface CapturedMail {
  html?: string;
  subject: string;
  text: string;
  to: string;
}

const tokenFromVerifyUrl = (text: string): string => {
  const match = text.match(/token=([0-9a-f]+)/i);
  assert.isNotNull(match);
  return match?.[1] ?? "";
};

describe("email verification gating", () => {
  let gatedApp: express.Application;
  let openApp: express.Application;
  let gatedMail: CapturedMail[];
  let openMail: CapturedMail[];

  beforeEach(async () => {
    await setupDb();
    await AuthToken.deleteMany({});
    gatedMail = [];
    openMail = [];

    gatedApp = new TerrenoApp({
      authOptions: {
        publicAppUrl: "https://app.example.com",
        requireEmailVerification: true,
        sendMail: async (message) => {
          gatedMail.push(message);
        },
      },
      skipListen: true,
      userModel: UserModel,
    }).build();

    openApp = new TerrenoApp({
      authOptions: {
        publicAppUrl: "https://app.example.com",
        sendMail: async (message) => {
          openMail.push(message);
        },
      },
      skipListen: true,
      userModel: UserModel,
    }).build();
  });

  it("returns 403 email-not-verified on login when the user is unverified", async () => {
    const response = await supertest(gatedApp)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(403);
    assert.equal(response.body.code, "email-not-verified");
  });

  it("allows login when requireEmailVerification is off", async () => {
    await supertest(openApp)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(200);
  });

  it("lets an unverified user verify then login when gating is on", async () => {
    const signup = await supertest(gatedApp)
      .post("/auth/signup")
      .send({email: "new-verify@example.com", password: "password"})
      .expect(200);
    assert.isString(signup.body.data.token);
    assert.equal(gatedMail.length, 1);
    const token = tokenFromVerifyUrl(gatedMail[0]?.text ?? "");

    await supertest(gatedApp)
      .post("/auth/login")
      .send({
        email: "new-verify@example.com",
        password: "password",
      })
      .expect(403);

    await supertest(gatedApp).post("/auth/verifyEmail").send({token}).expect(200);

    await supertest(gatedApp)
      .post("/auth/login")
      .send({email: "new-verify@example.com", password: "password"})
      .expect(200);
  });

  it("resends verification mail for an authenticated unverified user", async () => {
    const login = await supertest(openApp)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(200);

    await supertest(openApp)
      .post("/auth/sendVerification")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .expect(202);
    assert.equal(openMail.length, 1);
    assert.include(openMail[0]?.text ?? "", "https://app.example.com/verifyEmail?token=");
  });
});
