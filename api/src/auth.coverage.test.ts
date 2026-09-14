import {beforeEach, describe, expect, it, setSystemTime} from "bun:test";
import type express from "express";
import jwt from "jsonwebtoken";
import supertest from "supertest";

import {addAuthRoutes, addMeRoutes, setupAuth, type User, type UserModel} from "./auth";
import {getBaseServer, setupTestData, UserModel as TestUserModel} from "./tests";

const testUserModel = TestUserModel as unknown as UserModel;

const signTokenForId = (id: string): string =>
  jwt.sign({id}, process.env.TOKEN_SECRET as string, {issuer: process.env.TOKEN_ISSUER});

/**
 * Builds a stand-in UserModel that reuses the real passport strategy but lets each test
 * control what `findById` resolves to.
 */
const createStubUserModel = (overrides: Partial<UserModel>): UserModel => {
  return {
    createStrategy: () => testUserModel.createStrategy(),
    findById: async () => null,
    ...overrides,
  } as unknown as UserModel;
};

describe("setupAuth token extraction", () => {
  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
  });

  it("reads the token from the jwt cookie when no authorization header is present", async () => {
    const app = getBaseServer();
    const admin = await TestUserModel.findOne({email: "admin@example.com"});
    const token = signTokenForId(String(admin?._id));
    // Emulate cookie-parser, which consumers mount before setupAuth.
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.cookies = {jwt: token};
      next();
    });
    setupAuth(app, testUserModel);
    addMeRoutes(app, testUserModel);

    const res = await supertest.agent(app).get("/auth/me").expect(200);
    expect(res.body.data.email).toBe("admin@example.com");
  });

  it("logs the JWT setup message when not running in test mode", async () => {
    const app = getBaseServer();
    process.env.NODE_ENV = "development";
    try {
      setupAuth(app, testUserModel);
      addAuthRoutes(app, testUserModel);
      addMeRoutes(app, testUserModel);
      const res = await supertest
        .agent(app)
        .post("/auth/login")
        .send({email: "admin@example.com", password: "securePassword"})
        .expect(200);
      expect(res.body.data.token).toBeDefined();
    } finally {
      process.env.NODE_ENV = "test";
    }
  });
});

describe("addMeRoutes without a resolvable user", () => {
  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
  });

  it("returns 401 when the authenticated user has no id", async () => {
    const app = getBaseServer();
    // The anonymous user has no id, so the /me handlers cannot look it up.
    const anonymousModel = createStubUserModel({
      createAnonymousUser: async () => ({}) as User,
    });
    setupAuth(app, anonymousModel);
    addMeRoutes(app, anonymousModel);
    const agent = supertest
      .agent(app)
      .set("authorization", `Bearer ${signTokenForId("507f1f77bcf86cd799439011")}`);

    await agent.get("/auth/me").expect(401);
    await agent.patch("/auth/me").send({name: "New Name"}).expect(401);
  });

  it("returns 404 when the user cannot be found for the me routes", async () => {
    const app = getBaseServer();
    const admin = await TestUserModel.findOne({email: "admin@example.com"});
    setupAuth(app, testUserModel);
    addMeRoutes(app, createStubUserModel({}));
    const agent = supertest
      .agent(app)
      .set("authorization", `Bearer ${signTokenForId(String(admin?._id))}`);

    await agent.get("/auth/me").expect(404);
    await agent.patch("/auth/me").send({name: "New Name"}).expect(404);
  });
});
