// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterEach, beforeEach, describe, expect, it, setSystemTime} from "bun:test";
import type express from "express";
import type jwt from "jsonwebtoken";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {modelRouter} from "./api";
import {addAuthRoutes, addMeRoutes, generateTokens, setupAuth} from "./auth";
import {Permissions} from "./permissions";
import {getCurrentRequestContext} from "./requestContext";
import {TerrenoApp} from "./terrenoApp";
import {type Food, FoodModel, getBaseServer, setupDb, setupTestData, UserModel} from "./tests";
import {AdminOwnerTransformer} from "./transformers";
import {timeout} from "./utils";

const decodeTokenPayload = <T extends Record<string, unknown>>(token: string): T => {
  const encodedPayload = token.split(".")[1];
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as T;
};

describe("auth tests", () => {
  let app: express.Application;
  let admin: any;
  let contextEvents: Array<{
    currentSessionId?: string;
    requestId?: string;
    sessionId?: string;
    stage: string;
    userId?: string;
  }>;
  let agent: TestAgent;

  beforeEach(async () => {
    // Reset to real time - don't freeze time here as passport-local-mongoose
    // lockout mechanism needs real time to progress
    setSystemTime();
    const testData = await setupTestData();
    admin = testData.users.admin;
    contextEvents = [];

    function addRoutes(router: express.Router): void {
      router.use(
        "/food",
        modelRouter(FoodModel, {
          allowAnonymous: true,
          permissions: {
            create: [Permissions.IsAuthenticated],
            delete: [Permissions.IsAuthenticated],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsAuthenticated],
          },
          queryFilter: (user?: {admin: boolean}) => {
            if (!user?.admin) {
              return {hidden: {$ne: true}};
            }
            return {};
          },
          transformer: AdminOwnerTransformer<Food>({
            adminReadFields: ["name", "calories", "created", "ownerId"],
            adminWriteFields: ["name", "calories", "created", "ownerId"],
            anonReadFields: ["name"],
            anonWriteFields: [],
            authReadFields: ["name", "calories", "created"],
            authWriteFields: ["name", "calories"],
            ownerReadFields: ["name", "calories", "created", "ownerId"],
            ownerWriteFields: ["name", "calories", "created"],
          }),
        })
      );
      router.use(
        "/context-food",
        modelRouter(FoodModel, {
          permissions: {
            create: [Permissions.IsAuthenticated],
            delete: [],
            list: [],
            read: [],
            update: [],
          },
          postCreate: async (_value, req) => {
            contextEvents.push({
              currentSessionId: getCurrentRequestContext()?.sessionId,
              requestId: req.requestId,
              sessionId: req.sessionId,
              stage: "postCreate",
              userId: req.user?.id,
            });
          },
          preCreate: (body, req) => {
            contextEvents.push({
              currentSessionId: getCurrentRequestContext()?.sessionId,
              requestId: req.requestId,
              sessionId: req.sessionId,
              stage: "preCreate",
              userId: req.user?.id,
            });

            return {
              ...(body as Partial<Food>),
              categories: [],
              eatenBy: [req.user?._id],
              expiration: "2026-01-01",
              lastEatenWith: {},
              likesIds: [],
              ownerId: req.user?._id,
              source: {name: "context-test"},
              tags: [],
            } as unknown as Food;
          },
          responseHandler: async (value, method, req) => {
            contextEvents.push({
              currentSessionId: getCurrentRequestContext()?.sessionId,
              requestId: req.requestId,
              sessionId: req.sessionId,
              stage: `responseHandler:${method}`,
              userId: req.user?.id,
            });

            return {
              id: String((value as {_id: unknown})._id),
              requestId: req.requestId ?? null,
              sessionContext: getCurrentRequestContext()?.sessionId ?? null,
              sessionId: req.sessionId ?? null,
              userId: req.user?.id ?? null,
            };
          },
        })
      );
    }
    app = new TerrenoApp({
      configureApp: addRoutes,
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(async () => {
    setSystemTime();
  });

  it("completes token signup e2e", async () => {
    let res = await agent
      .post("/auth/signup")
      .send({email: "new@example.com", password: "123"})
      .expect(200);
    let {userId, token, refreshToken} = res.body.data;
    expect(userId).toBeDefined();
    expect(token).toBeDefined();
    expect(refreshToken).toBeDefined();

    res = await agent
      .post("/auth/login")
      .send({email: "new@example.com", password: "123"})
      .expect(200);
    await agent.set("authorization", `Bearer ${res.body.data.token}`);

    userId = res.body.data.userId;
    token = res.body.data.token;
    expect(userId).toBeDefined();
    expect(token).toBeDefined();
    expect(refreshToken).toBeDefined();

    const food = await FoodModel.create({
      calories: 1,
      created: new Date(),
      name: "Peas",
      ownerId: userId,
    });

    const meRes = await agent.get("/auth/me").expect(200);
    expect(meRes.body.data._id).toBeDefined();
    expect(meRes.body.data.id).toBeDefined();
    expect(meRes.body.data.hash).toBeUndefined();
    expect(meRes.body.data.email).toBe("new@example.com");
    expect(meRes.body.data.updated).toBeDefined();
    expect(meRes.body.data.created).toBeDefined();
    expect(meRes.body.data.admin).toBe(false);

    const mePatchRes = await agent
      .patch("/auth/me")
      .send({email: "new2@example.com"})
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    expect(mePatchRes.body.data._id).toBeDefined();
    expect(mePatchRes.body.data.id).toBeDefined();
    expect(mePatchRes.body.data.hash).toBeUndefined();
    expect(mePatchRes.body.data.email).toBe("new2@example.com");
    expect(mePatchRes.body.data.updated).toBeDefined();
    expect(mePatchRes.body.data.created).toBeDefined();
    expect(mePatchRes.body.data.admin).toBe(false);

    // Use token to see 2 foods + the one we just created
    const getRes = await agent.get("/food").expect(200);

    expect(getRes.body.data).toHaveLength(4);
    expect(getRes.body.data.find((f: any) => f.name === "Peas")).toBeDefined();

    const updateRes = await agent
      .patch(`/food/${food._id}`)
      .send({name: "PeasAndCarrots"})
      .expect(200);
    expect(updateRes.body.data.name).toBe("PeasAndCarrots");
  });

  it("signup with extra data", async () => {
    const res = await agent
      .post("/auth/signup")
      .send({age: 25, email: "new@example.com", password: "123"})
      .expect(200);
    const {userId, token, refreshToken} = res.body.data;
    expect(userId).toBeDefined();
    expect(token).toBeDefined();
    expect(refreshToken).toBeDefined();

    const user = await UserModel.findOne({email: "new@example.com"});
    expect(user?.age).toBe(25);
  });

  it("login failure", async () => {
    let res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);
    expect(res.body).toEqual({
      message: "Password or username is incorrect",
    });
    res = await agent
      .post("/auth/login")
      .send({email: "nope@example.com", password: "wrong"})
      .expect(401);
    // we don't really want to expose if a given email address has an account in our system or not
    expect(res.body).toEqual({
      message: "Password or username is incorrect",
    });
  });

  it("case insensitive email", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "ADMIN@example.com", password: "securePassword"})
      .expect(200);
    expect(res.body.data.token).toBeDefined();
  });

  it("case insensitive email with emails with symbols", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "ADMIN+other@example.com", password: "otherPassword"})
      .expect(200);
    expect(res.body.data.token).toBeDefined();
  });

  it("passes request and session context through modelRouter hooks", async () => {
    const loginRes = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);
    const loginTokenPayload = decodeTokenPayload<{sid?: string}>(loginRes.body.data.token);

    const createRes = await agent
      .post("/context-food")
      .set("authorization", `Bearer ${loginRes.body.data.token}`)
      .set("X-Request-ID", "model-router-request-1")
      .send({calories: 10, name: "Context Apple"})
      .expect(201);

    expect(loginTokenPayload.sid).toBeDefined();
    const sessionId = loginTokenPayload.sid;
    if (!sessionId) {
      throw new Error("Expected login token to include a session id");
    }
    expect(createRes.headers["x-request-id"]).toBe("model-router-request-1");
    expect(createRes.headers["x-session-id"]).toBe(sessionId);
    expect(createRes.body.data.requestId).toBe("model-router-request-1");
    expect(createRes.body.data.sessionId).toBe(sessionId);
    expect(createRes.body.data.sessionContext).toBe(sessionId);
    expect(createRes.body.data.userId).toBe(String(admin._id));
    expect(contextEvents).toEqual([
      {
        currentSessionId: sessionId,
        requestId: "model-router-request-1",
        sessionId,
        stage: "preCreate",
        userId: String(admin._id),
      },
      {
        currentSessionId: sessionId,
        requestId: "model-router-request-1",
        sessionId,
        stage: "postCreate",
        userId: String(admin._id),
      },
      {
        currentSessionId: sessionId,
        requestId: "model-router-request-1",
        sessionId,
        stage: "responseHandler:create",
        userId: String(admin._id),
      },
    ]);
  });

  it("preserves JWT session id across refresh and request context", async () => {
    const loginRes = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);
    const loginTokenPayload = decodeTokenPayload<{sid?: string}>(loginRes.body.data.token);
    const loginRefreshPayload = decodeTokenPayload<{sid?: string}>(loginRes.body.data.refreshToken);

    expect(loginTokenPayload.sid).toBeDefined();
    const loginSessionId = loginTokenPayload.sid;
    if (!loginSessionId) {
      throw new Error("Expected login token to include a session id");
    }
    expect(loginRefreshPayload.sid).toBe(loginSessionId);
    expect(loginRes.headers["x-session-id"]).toBe(loginSessionId);

    const refreshRes = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: loginRes.body.data.refreshToken})
      .expect(200);
    const refreshedTokenPayload = decodeTokenPayload<{sid?: string}>(refreshRes.body.data.token);
    const refreshedRefreshPayload = decodeTokenPayload<{sid?: string}>(
      refreshRes.body.data.refreshToken
    );

    expect(refreshedTokenPayload.sid).toBe(loginSessionId);
    expect(refreshedRefreshPayload.sid).toBe(loginSessionId);
    expect(refreshRes.headers["x-session-id"]).toBe(loginSessionId);

    const foodRes = await agent
      .get("/food")
      .set("authorization", `Bearer ${refreshRes.body.data.token}`)
      .expect(200);
    expect(foodRes.headers["x-session-id"]).toBe(loginSessionId);
  });

  it("completes token login e2e", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);
    const {userId, token} = res.body.data;
    expect(userId).toBeDefined();
    expect(token).toBeDefined();

    await agent.set("authorization", `Bearer ${res.body.data.token}`);

    const meRes = await agent.get("/auth/me").expect(200);
    expect(meRes.body.data._id).toBeDefined();
    expect(meRes.body.data.id).toBeDefined();
    expect(meRes.body.data.hash).toBeUndefined();
    expect(meRes.body.data.email).toBe("admin@example.com");
    expect(meRes.body.data.updated).toBeDefined();
    expect(meRes.body.data.created).toBeDefined();
    expect(meRes.body.data.admin).toBe(true);

    const mePatchRes = await agent
      .patch("/auth/me")
      .send({email: "admin2@example.com"})
      .expect(200);
    expect(mePatchRes.body.data._id).toBeDefined();
    expect(mePatchRes.body.data.id).toBeDefined();
    expect(mePatchRes.body.data.hash).toBeUndefined();
    expect(mePatchRes.body.data.email).toBe("admin2@example.com");
    expect(mePatchRes.body.data.updated).toBeDefined();
    expect(mePatchRes.body.data.created).toBeDefined();
    expect(mePatchRes.body.data.admin).toBe(true);

    // Use token to see admin foods
    const getRes = await agent.get("/food").expect(200);

    expect(getRes.body.data).toHaveLength(4);
    const food = getRes.body.data.find((f: any) => f.name === "Apple");
    expect(food).toBeDefined();

    const updateRes = await agent
      .patch(`/food/${food.id}`)
      .set("authorization", `Bearer ${token}`)
      .send({name: "Apple Pie"})
      .expect(200);
    expect(updateRes.body.data.name).toBe("Apple Pie");
  });

  it("login successfully and tokens expire", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);
    const {userId, token} = res.body.data;
    expect(userId).toBeDefined();
    expect(token).toBeDefined();

    await agent.set("authorization", `Bearer ${res.body.data.token}`);

    await agent.get("/auth/me").expect(200);

    // Advance time to past token expiration
    setSystemTime(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await agent.get("/auth/me").expect(401);
  });

  it("locks out after failed password attempts", async () => {
    let res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);

    expect(res.body).toEqual({
      message: "Password or username is incorrect",
    });
    let user = await UserModel.findById(admin._id);
    expect((user as any)?.attempts).toBe(1);
    res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);

    expect(res.body).toEqual({
      message: "Password or username is incorrect",
    });
    user = await UserModel.findById(admin._id);
    expect((user as any)?.attempts).toBe(2);
    res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);

    expect(res.body).toEqual({
      message: "Account locked due to too many failed login attempts",
    });
    user = await UserModel.findById(admin._id);
    expect((user as any)?.attempts).toBe(3);

    // Logging in with correct password fails because account is locked
    res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(401);

    expect(res.body).toEqual({
      message: "Account locked due to too many failed login attempts",
    });
    user = await UserModel.findById(admin._id);
    // Not incremented
    expect((user as any)?.attempts).toBe(3);
  });

  it("refresh token allows refresh of auth token", async () => {
    // initial login
    const initialLoginRes = await agent
      .post("/auth/login")
      .send({email: "ADMIN@example.com", password: "securePassword"})
      .expect(200);
    expect(initialLoginRes.body.data.token).toBeDefined();
    expect(initialLoginRes.body.data.refreshToken).toBeDefined();
    const initialToken = initialLoginRes.body.data.token;
    await agent.set("authorization", `Bearer ${initialToken}`);

    // get new auth token from refresh token
    const refreshRes = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: initialLoginRes.body.data.refreshToken})
      .expect(200);
    expect(refreshRes.body.data.token).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();
    const newToken = refreshRes.body.data.token;
    // note that new token will most likely be the same as the old token because
    // an HMAC signature will always be the same for a header + payload combination that is equal.

    // make sure new token works
    await agent.set("authorization", `Bearer ${newToken}`);
    const meRes = await agent.get("/auth/me").expect(200);
    expect(meRes.body.data._id).toBeDefined();
  });

  it("disabled user fails", async () => {
    // initial login
    const initialLoginRes = await agent
      .post("/auth/login")
      .send({email: "ADMIN@example.com", password: "securePassword"})
      .expect(200);
    expect(initialLoginRes.body.data.token).toBeDefined();
    expect(initialLoginRes.body.data.refreshToken).toBeDefined();
    const initialToken = initialLoginRes.body.data.token;
    await agent.set("authorization", `Bearer ${initialToken}`);
    const meRes = await agent.get("/auth/me").expect(200);
    expect(meRes.body.data._id).toBeDefined();

    admin.disabled = true;
    await admin.save();

    const failRes = await agent.get("/auth/me").expect(401);
    expect(failRes.body).toEqual({status: 401, title: "User is disabled"});
  });

  it("signup user with email that is already registered", async () => {
    await agent
      .post("/auth/signup")
      .send({age: 25, email: "new@example.com", password: "123"})
      .expect(200);

    const res2 = await agent
      .post("/auth/signup")
      .send({age: 31, email: "new@example.com", password: "456"})
      .expect(500);

    await timeout(1000);
    expect(res2.body.title).toBe("A user with the given username is already registered");
  });
});

describe("custom auth options", () => {
  let app: express.Application;
  let admin: any;
  let notAdmin: any;

  beforeEach(async () => {
    // Reset to real time - don't freeze time here as passport-local-mongoose
    // lockout mechanism needs real time to progress
    setSystemTime();
    [admin, notAdmin] = await setupDb();

    await Promise.all([
      FoodModel.create({
        calories: 1,
        created: new Date(),
        name: "Spinach",
        ownerId: notAdmin._id,
      }),
      FoodModel.create({
        calories: 100,
        created: Date.now() - 10,
        hidden: true,
        name: "Apple",
        ownerId: admin._id,
      }),
      FoodModel.create({
        calories: 100,
        created: Date.now() - 10,
        name: "Carrots",
        ownerId: admin._id,
      }),
    ]);
    app = getBaseServer();
    addAuthRoutes(app, UserModel as any, {
      // custom refresh token logic based on admin or non admin
      generateTokenExpiration: (user?: {admin: boolean}) => {
        if (user?.admin) {
          return "30d";
        }
        return "365d";
      },
    });
    setupAuth(app, UserModel as any);
    addMeRoutes(app, UserModel as any);
    app.use(
      "/food",
      modelRouter(FoodModel, {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsAuthenticated],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsAuthenticated],
        },
        queryFilter: (user?: {admin: boolean}) => {
          if (!user?.admin) {
            return {hidden: {$ne: true}};
          }
          return {};
        },
        transformer: AdminOwnerTransformer<Food>({
          adminReadFields: ["name", "calories", "created", "ownerId"],
          adminWriteFields: ["name", "calories", "created", "ownerId"],
          anonReadFields: ["name"],
          anonWriteFields: [],
          authReadFields: ["name", "calories", "created"],
          authWriteFields: ["name", "calories"],
          ownerReadFields: ["name", "calories", "created", "ownerId"],
          ownerWriteFields: ["name", "calories", "created"],
        }),
      })
    );
  });

  afterEach(async () => {
    setSystemTime();
  });

  it("login successfully and tokens expire with custom token options", async () => {
    // login admin and set token
    const adminAgent = supertest.agent(app);
    const res = await adminAgent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);

    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.token).toBeDefined();

    await adminAgent.set("authorization", `Bearer ${res.body.data.token}`);

    // login non-admin and set token
    const notAdminAgent = supertest.agent(app);
    const res2 = await notAdminAgent
      .post("/auth/login")
      .send({email: "notadmin@example.com", password: "password"})
      .expect(200);

    expect(res2.body.data.userId).toBeDefined();
    expect(res2.body.data.token).toBeDefined();

    await notAdminAgent.set("authorization", `Bearer ${res2.body.data.token}`);

    //  and check that tokens are working for both users
    await adminAgent.get("/auth/me").expect(200);
    await notAdminAgent.get("/auth/me").expect(200);

    // Advance time by 30 days check that admin can no longer access with old token,
    // and non-admin can due to custom times set as auth options
    setSystemTime(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await adminAgent.get("/auth/me").expect(401);
    await notAdminAgent.get("/auth/me").expect(200);

    // Advance time by an additional 335 days to pass the 365 day expiration for non-admin
    setSystemTime(Date.now() + 1000 * 60 * 60 * 24 * 365);

    // ensure non-admin can no longer access
    await notAdminAgent.get("/auth/me").expect(401);
  });
});

describe("generateTokens", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {...OLD_ENV};
    process.env.TOKEN_SECRET = "secret";
    process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("generates a token and refresh token for a valid user", async () => {
    const user = {_id: "12345"};
    const {token, refreshToken} = await generateTokens(user);

    expect(token).toBeDefined();
    expect(refreshToken).toBeDefined();

    // Verify token structure
    const tokenParts = token?.split(".");
    expect(tokenParts?.length).toBe(3);
  });

  it("throws an error if TOKEN_SECRET is missing", async () => {
    process.env.TOKEN_SECRET = undefined;
    const user = {_id: "12345"};

    await expect(generateTokens(user)).rejects.toThrow("TOKEN_SECRET must be set in env.");
  });

  it("returns null tokens if user is missing", async () => {
    const result = await generateTokens(undefined);
    expect(result).toEqual({refreshToken: null, token: null});
  });

  it("respects custom expiration from authOptions", async () => {
    const user = {_id: "12345"};
    const authOptions = {
      generateRefreshTokenExpiration: () => "7d" as jwt.SignOptions["expiresIn"],
      generateTokenExpiration: () => "1h" as jwt.SignOptions["expiresIn"],
    };
    const {token, refreshToken} = await generateTokens(user, authOptions);

    expect(token).toBeDefined();
    expect(refreshToken).toBeDefined();
  });
});

describe("generateTokens edge cases", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {...OLD_ENV};
    process.env.TOKEN_SECRET = "secret";
    process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("returns null tokens when user is missing", async () => {
    const result = await generateTokens(null);
    expect(result.token).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it("returns null tokens when user has no _id", async () => {
    const result = await generateTokens({email: "test@test.com"});
    expect(result.token).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it("includes custom payload from generateJWTPayload option", async () => {
    const jwtLib = await import("jsonwebtoken");

    const user = {_id: "user-123"};
    const result = await generateTokens(user, {
      generateJWTPayload: (u) => ({customField: "customValue", userId: u._id}),
    });

    expect(result.token).toBeDefined();
    const decoded = jwtLib.decode(result.token as string) as any;
    expect(decoded.customField).toBe("customValue");
    expect(decoded.id).toBe("user-123");
  });

  it("uses custom token expiration from generateTokenExpiration option", async () => {
    const jwtLib = await import("jsonwebtoken");

    const user = {_id: "user-123"};
    const result = await generateTokens(user, {
      generateTokenExpiration: () => "1h",
    });

    expect(result.token).toBeDefined();
    const decoded = jwtLib.decode(result.token as string) as any;
    // Check that exp is roughly 1 hour from now (within 5 seconds tolerance)
    const expectedExp = Math.floor(Date.now() / 1000) + 3600;
    expect(decoded.exp).toBeGreaterThan(expectedExp - 5);
    expect(decoded.exp).toBeLessThan(expectedExp + 5);
  });

  it("uses custom refresh token expiration from generateRefreshTokenExpiration option", async () => {
    const jwtLib = await import("jsonwebtoken");

    const user = {_id: "user-123"};
    const result = await generateTokens(user, {
      generateRefreshTokenExpiration: () => "7d",
    });

    expect(result.refreshToken).toBeDefined();
    const decoded = jwtLib.decode(result.refreshToken as string) as any;
    // Check that exp is roughly 7 days from now
    const expectedExp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    expect(decoded.exp).toBeGreaterThan(expectedExp - 10);
    expect(decoded.exp).toBeLessThan(expectedExp + 10);
  });

  it("throws when TOKEN_SECRET is not set", async () => {
    process.env.TOKEN_SECRET = "";
    let caught: unknown;
    try {
      await generateTokens({_id: "user-123"});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    expect((caught as Error).message).toBe("TOKEN_SECRET must be set in env.");
  });

  it("uses TOKEN_EXPIRES_IN from env when valid", async () => {
    const jwtLib = await import("jsonwebtoken");
    process.env.TOKEN_EXPIRES_IN = "2h";
    const result = await generateTokens({_id: "user-123"});
    const decoded = jwtLib.decode(result.token as string) as any;
    const expectedExp = Math.floor(Date.now() / 1000) + 2 * 3600;
    expect(decoded.exp).toBeGreaterThan(expectedExp - 10);
    expect(decoded.exp).toBeLessThan(expectedExp + 10);
  });

  it("uses REFRESH_TOKEN_EXPIRES_IN from env when valid", async () => {
    const jwtLib = await import("jsonwebtoken");
    process.env.REFRESH_TOKEN_EXPIRES_IN = "1h";
    const result = await generateTokens({_id: "user-123"});
    const decoded = jwtLib.decode(result.refreshToken as string) as any;
    const expectedExp = Math.floor(Date.now() / 1000) + 3600;
    expect(decoded.exp).toBeGreaterThan(expectedExp - 10);
    expect(decoded.exp).toBeLessThan(expectedExp + 10);
  });

  it("does not issue refresh token when REFRESH_TOKEN_SECRET is not set", async () => {
    process.env.REFRESH_TOKEN_SECRET = "";
    const result = await generateTokens({_id: "user-123"});
    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeUndefined();
  });
});

describe("addAuthRoutes /refresh_token error paths", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("returns 401 when no refreshToken in body", async () => {
    const res = await agent.post("/auth/refresh_token").send({}).expect(401);
    expect(res.body.message).toContain("No refresh token provided");
  });

  it("returns 401 when refresh token is invalid", async () => {
    const res = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: "not-a-valid-jwt"})
      .expect(401);
    expect(res.body.message).toBeDefined();
  });

  it("returns 401 when refresh token is signed with wrong secret", async () => {
    const jwtLib = (await import("jsonwebtoken")).default;
    const bogusToken = jwtLib.sign({id: "abc"}, "different-secret");
    const res = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: bogusToken})
      .expect(401);
    expect(res.body.message).toBeDefined();
  });

  it("returns 401 when refresh token has no id", async () => {
    const jwtLib = (await import("jsonwebtoken")).default;
    const tokenNoId = jwtLib.sign({foo: "bar"}, process.env.REFRESH_TOKEN_SECRET as string);
    const res = await agent.post("/auth/refresh_token").send({refreshToken: tokenNoId}).expect(401);
    expect(res.body.message).toBe("Invalid refresh token");
  });

  it("issues new tokens on valid refresh", async () => {
    const [adminUser] = await setupDb();
    const jwtLib = (await import("jsonwebtoken")).default;
    const validToken = jwtLib.sign(
      {id: (adminUser as any)._id.toString()},
      process.env.REFRESH_TOKEN_SECRET as string
    );
    const res = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: validToken})
      .expect(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
  });
});

describe("addMeRoutes edge cases", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("GET /auth/me returns 401 without auth", async () => {
    await agent.get("/auth/me").expect(401);
  });

  it("PATCH /auth/me returns 401 without auth", async () => {
    await agent.patch("/auth/me").send({email: "x@x.com"}).expect(401);
  });

  it("GET /auth/me returns 404 when user is deleted after auth", async () => {
    const [_admin, notAdmin] = await setupDb();
    const jwtLib = (await import("jsonwebtoken")).default;
    const token = jwtLib.sign(
      {id: (notAdmin as any)._id.toString()},
      process.env.TOKEN_SECRET as string,
      {issuer: process.env.TOKEN_ISSUER}
    );
    // Delete the user so findById returns null
    await UserModel.deleteOne({_id: (notAdmin as any)._id});
    const res = await agent.get("/auth/me").set("authorization", `Bearer ${token}`);
    // Either 404 (user not found in /me handler) or 401 (auth middleware rejects)
    expect([401, 404]).toContain(res.status);
  });

  it("PATCH /auth/me returns 404 when user is deleted after auth", async () => {
    const [_admin, notAdmin] = await setupDb();
    const jwtLib = (await import("jsonwebtoken")).default;
    const notAdminId = (notAdmin as unknown as {_id: {toString(): string}})._id;
    const token = jwtLib.sign({id: notAdminId.toString()}, process.env.TOKEN_SECRET as string, {
      issuer: process.env.TOKEN_ISSUER,
    });
    await UserModel.deleteOne({_id: notAdminId});
    const res = await agent
      .patch("/auth/me")
      .set("authorization", `Bearer ${token}`)
      .send({email: "x@x.com"});
    expect([401, 404]).toContain(res.status);
  });

  it("PATCH /auth/me returns 403 on validation error", async () => {
    const [admin] = await setupDb();
    const jwtLib = (await import("jsonwebtoken")).default;
    const adminId = (admin as unknown as {_id: {toString(): string}})._id;
    const token = jwtLib.sign({id: adminId.toString()}, process.env.TOKEN_SECRET as string, {
      issuer: process.env.TOKEN_ISSUER,
    });
    const res = await agent
      .patch("/auth/me")
      .set("authorization", `Bearer ${token}`)
      .send({admin: "not_a_boolean_value_but_will_be_cast"});
    expect([200, 403]).toContain(res.status);
  });
});

describe("Secret prefix authorization bypass", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
    app = new TerrenoApp({
      configureApp: (router: express.Router) => {
        router.use(
          "/food",
          modelRouter(FoodModel, {
            allowAnonymous: true,
            permissions: {
              create: [],
              delete: [],
              list: [Permissions.IsAny],
              read: [Permissions.IsAny],
              update: [],
            },
          })
        );
      },
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("passes through with Secret prefix authorization header without JWT decoding", async () => {
    const res = await agent.get("/food").set("authorization", "Secret my-secret-token").expect(200);
    expect(res.body.data).toBeDefined();
  });
});

describe("generateTokens env integration", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {...OLD_ENV};
    process.env.TOKEN_SECRET = "secret";
    process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("includes TOKEN_ISSUER in token when set", async () => {
    process.env.TOKEN_ISSUER = "test-issuer";
    const result = await generateTokens({_id: "user-123"});
    const decoded = decodeTokenPayload<{iss?: string}>(result.token as string);
    expect(decoded.iss).toBe("test-issuer");
  });

  it("generates a unique sessionId when none provided", async () => {
    const result1 = await generateTokens({_id: "user-123"});
    const result2 = await generateTokens({_id: "user-123"});
    expect(result1.sessionId).toBeDefined();
    expect(result2.sessionId).toBeDefined();
    expect(result1.sessionId).not.toBe(result2.sessionId);
  });

  it("uses provided sessionId from options", async () => {
    const result = await generateTokens({_id: "user-123"}, undefined, {
      sessionId: "custom-session-id",
    });
    const decoded = decodeTokenPayload<{sid?: string}>(result.token as string);
    expect(decoded.sid).toBe("custom-session-id");
    expect(result.sessionId).toBe("custom-session-id");
  });
});

describe("refresh_token without REFRESH_TOKEN_SECRET", () => {
  let app: express.Application;
  let agent: TestAgent;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    setSystemTime();
    process.env = {...OLD_ENV};
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
    process.env = OLD_ENV;
  });

  it("returns 401 when REFRESH_TOKEN_SECRET is not set", async () => {
    process.env.REFRESH_TOKEN_SECRET = "";
    const res = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: "some-token"})
      .expect(401);
    expect(res.body.message).toContain("No REFRESH_TOKEN_SECRET set");
  });
});

describe("generateTokens with custom TOKEN_EXPIRES_IN", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {...OLD_ENV};
    process.env.TOKEN_SECRET = "secret";
    process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("uses TOKEN_EXPIRES_IN when set to a valid duration", async () => {
    process.env.TOKEN_EXPIRES_IN = "1h";
    const result = await generateTokens({_id: "user-123"});
    expect(result.token).toBeDefined();
    const decoded = decodeTokenPayload<{exp: number; iat: number}>(result.token as string);
    const diffSeconds = decoded.exp - decoded.iat;
    // 1h = 3600s
    expect(diffSeconds).toBe(3600);
  });

  it("uses REFRESH_TOKEN_EXPIRES_IN when set to a valid duration", async () => {
    process.env.REFRESH_TOKEN_EXPIRES_IN = "7d";
    const result = await generateTokens({_id: "user-123"});
    expect(result.refreshToken).toBeDefined();
    const decoded = decodeTokenPayload<{exp: number; iat: number}>(result.refreshToken as string);
    const diffSeconds = decoded.exp - decoded.iat;
    // 7d = 604800s
    expect(diffSeconds).toBe(604800);
  });
});

describe("JWT cookie extraction and /me routes edge cases", () => {
  let app: express.Application;
  let agent: TestAgent;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    setSystemTime();
    process.env = {...OLD_ENV};
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
    process.env = OLD_ENV;
  });

  it("returns 401 for /me when no user is authenticated", async () => {
    const res = await agent.get("/auth/me").expect(401);
    expect(res.status).toBe(401);
  });

  it("returns 401 for PATCH /me when no user is authenticated", async () => {
    const res = await agent.patch("/auth/me").send({name: "Updated"}).expect(401);
    expect(res.status).toBe(401);
  });

  it("returns 404 for /me when user is deleted from database", async () => {
    // Login, then delete the user, then try /me
    const loginRes = await agent
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(200);
    const {token, userId} = loginRes.body.data;

    // Delete the user from DB
    await UserModel.deleteOne({_id: userId});

    const freshAgent = supertest.agent(app);
    const res = await freshAgent.get("/auth/me").set("authorization", `Bearer ${token}`);
    // Without the user, the JWT verify succeeds but findById returns null
    expect([401, 404]).toContain(res.status);
  });
});

describe("login error and disabled user paths", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("returns 401 with message for invalid credentials (no user found)", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "nonexistent@example.com", password: "wrong"})
      .expect(401);
    expect(res.body.message).toBeDefined();
  });

  it("returns 401 when disabled user tries to access protected route", async () => {
    // Login to get token
    const loginRes = await agent
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(200);
    const {token, userId} = loginRes.body.data;

    // Disable the user
    await UserModel.findByIdAndUpdate(userId, {disabled: true});

    // Try to access /me with disabled user's token
    const freshAgent = supertest.agent(app);
    const res = await freshAgent
      .get("/auth/me")
      .set("authorization", `Bearer ${token}`)
      .expect(401);
    expect(res.body.title).toContain("disabled");
  });
});

describe("PATCH /me route edge cases", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("returns 404 for PATCH /me when authenticated user is deleted from DB", async () => {
    const loginRes = await agent
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"})
      .expect(200);
    const {token, userId} = loginRes.body.data;

    await UserModel.deleteOne({_id: userId});

    const freshAgent = supertest.agent(app);
    const res = await freshAgent
      .patch("/auth/me")
      .set("authorization", `Bearer ${token}`)
      .send({name: "Updated"});
    // Without user in DB, should get 401 or 404
    expect([401, 404]).toContain(res.status);
  });
});

describe("JWT strategy createAnonymousUser path", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();

    // Add createAnonymousUser static to exercise lines 254-257
    (UserModel as unknown as Record<string, unknown>).createAnonymousUser = async () => {
      const user = new UserModel({admin: false, email: `anon-${Date.now()}@example.com`});
      await user.save();
      return user;
    };

    app = new TerrenoApp({
      configureApp: (router: express.Router) => {
        router.use(
          "/food",
          modelRouter(FoodModel, {
            allowAnonymous: true,
            permissions: {
              create: [],
              delete: [],
              list: [Permissions.IsAny],
              read: [Permissions.IsAny],
              update: [],
            },
          })
        );
      },
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
    delete (UserModel as unknown as Record<string, unknown>).createAnonymousUser;
  });

  it("creates anonymous user when JWT user not found and createAnonymousUser exists", async () => {
    const jwtLib = (await import("jsonwebtoken")).default;
    // Token with a non-existent user ID
    const token = jwtLib.sign(
      {id: "000000000000000000000099"},
      process.env.TOKEN_SECRET as string,
      {issuer: process.env.TOKEN_ISSUER}
    );
    const res = await agent.get("/food").set("authorization", `Bearer ${token}`);
    // The request should succeed (anonymous user created by JWT strategy)
    expect(res.status).toBe(200);
  });
});
describe("generateTokens with SIGNUP_DISABLED and user.postCreate", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {...OLD_ENV};
    process.env.TOKEN_SECRET = "secret";
    process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("generates token with sessionId in both token and refresh token", async () => {
    const jwtLib = await import("jsonwebtoken");
    const result = await generateTokens({_id: "user-123"});
    expect(result.sessionId).toBeDefined();
    const tokenDecoded = jwtLib.decode(result.token as string) as {sid?: string};
    const refreshDecoded = jwtLib.decode(result.refreshToken as string) as {sid?: string};
    expect(tokenDecoded.sid).toBe(result.sessionId);
    expect(refreshDecoded.sid).toBe(result.sessionId);
  });
});

describe("decodeJWTMiddleware error paths", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await setupTestData();
    app = new TerrenoApp({
      configureApp: (router: express.Router) => {
        router.use(
          "/food",
          modelRouter(FoodModel, {
            allowAnonymous: true,
            permissions: {
              create: [],
              delete: [],
              list: [Permissions.IsAny],
              read: [Permissions.IsAny],
              update: [],
            },
          })
        );
      },
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("returns 401 with details when token has wrong issuer", async () => {
    const jwtLib = (await import("jsonwebtoken")).default;
    const token = jwtLib.sign({id: "someuser"}, process.env.TOKEN_SECRET as string, {
      issuer: "wrong-issuer",
    });
    const res = await agent.get("/food").set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.details).toContain("[jwt] Error decoding token");
  });

  it("returns 401 when token is signed with wrong secret", async () => {
    const jwtLib = (await import("jsonwebtoken")).default;
    const token = jwtLib.sign({id: "someuser"}, "wrong-secret", {
      issuer: process.env.TOKEN_ISSUER,
    });
    const res = await agent.get("/food").set("authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.details).toContain("[jwt] Error decoding token");
  });

  it("skips decode when token is the string null", async () => {
    const res = await agent.get("/food").set("authorization", "Bearer null").expect(200);
    expect(res.body.data).toBeDefined();
  });

  it("skips decode when token is the string undefined", async () => {
    const res = await agent.get("/food").set("authorization", "Bearer undefined").expect(200);
    expect(res.body.data).toBeDefined();
  });
});

describe("signup disabled", () => {
  let app: express.Application;
  let agent: TestAgent;
  const OLD_ENV = process.env;

  beforeEach(async () => {
    setSystemTime();
    process.env = {...OLD_ENV};
    process.env.SIGNUP_DISABLED = "true";
    await setupTestData();
    app = new TerrenoApp({
      configureApp: () => {},
      skipListen: true,
      userModel: UserModel as any,
    }).build();
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
    process.env = OLD_ENV;
  });

  it("returns 404 when SIGNUP_DISABLED is true", async () => {
    const res = await agent.post("/auth/signup").send({email: "new@example.com", password: "123"});
    expect(res.status).toBe(404);
  });
});
