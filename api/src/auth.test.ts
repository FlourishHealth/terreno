import {afterEach, beforeEach, describe, expect, it, setSystemTime} from "bun:test";
import {assert} from "chai";
import type express from "express";
import type jwt from "jsonwebtoken";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {modelRouter} from "./api";
import {addAuthRoutes, addMeRoutes, generateTokens, setupAuth} from "./auth";
import {setupServer} from "./expressServer";
import {Permissions} from "./permissions";
import {type Food, FoodModel, getBaseServer, setupDb, UserModel} from "./tests";
import {AdminOwnerTransformer} from "./transformers";
import {timeout} from "./utils";

describe("auth tests", () => {
  let app: express.Application;
  let admin: any;
  let notAdmin: any;
  let agent: TestAgent;

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
    }
    app = setupServer({
      addRoutes,
      skipListen: true,
      userModel: UserModel as any,
    });
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
    assert.isDefined(userId);
    assert.isDefined(token);
    assert.isDefined(refreshToken);

    res = await agent
      .post("/auth/login")
      .send({email: "new@example.com", password: "123"})
      .expect(200);
    await agent.set("authorization", `Bearer ${res.body.data.token}`);

    userId = res.body.data.userId;
    token = res.body.data.token;
    assert.isDefined(userId);
    assert.isDefined(token);
    assert.isDefined(refreshToken);

    const food = await FoodModel.create({
      calories: 1,
      created: new Date(),
      name: "Peas",
      ownerId: userId,
    });

    const meRes = await agent.get("/auth/me").expect(200);
    assert.isDefined(meRes.body.data._id);
    assert.isDefined(meRes.body.data.id);
    assert.isUndefined(meRes.body.data.hash);
    assert.equal(meRes.body.data.email, "new@example.com");
    assert.isDefined(meRes.body.data.updated);
    assert.isDefined(meRes.body.data.created);
    assert.isFalse(meRes.body.data.admin);

    const mePatchRes = await agent
      .patch("/auth/me")
      .send({email: "new2@example.com"})
      .set("authorization", `Bearer ${token}`)
      .expect(200);
    assert.isDefined(mePatchRes.body.data._id);
    assert.isDefined(mePatchRes.body.data.id);
    assert.isUndefined(mePatchRes.body.data.hash);
    assert.equal(mePatchRes.body.data.email, "new2@example.com");
    assert.isDefined(mePatchRes.body.data.updated);
    assert.isDefined(mePatchRes.body.data.created);
    assert.isFalse(mePatchRes.body.data.admin);

    // Use token to see 2 foods + the one we just created
    const getRes = await agent.get("/food").expect(200);

    assert.lengthOf(getRes.body.data, 3);
    assert.isDefined(getRes.body.data.find((f: any) => f.name === "Peas"));

    const updateRes = await agent
      .patch(`/food/${food._id}`)
      .send({name: "PeasAndCarrots"})
      .expect(200);
    assert.equal(updateRes.body.data.name, "PeasAndCarrots");
  });

  it("signup with extra data", async () => {
    const res = await agent
      .post("/auth/signup")
      .send({age: 25, email: "new@example.com", password: "123"})
      .expect(200);
    const {userId, token, refreshToken} = res.body.data;
    assert.isDefined(userId);
    assert.isDefined(token);
    assert.isDefined(refreshToken);

    const user = await UserModel.findOne({email: "new@example.com"});
    assert.equal(user?.age, 25);
  });

  it("login failure", async () => {
    let res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);
    assert.deepEqual(res.body, {
      message: "Password or username is incorrect",
    });
    res = await agent
      .post("/auth/login")
      .send({email: "nope@example.com", password: "wrong"})
      .expect(401);
    // we don't really want to expose if a given email address has an account in our system or not
    assert.deepEqual(res.body, {
      message: "Password or username is incorrect",
    });
  });

  it("case insensitive email", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "ADMIN@example.com", password: "securePassword"})
      .expect(200);
    assert.isDefined(res.body.data.token);
  });

  it("case insensitive email with emails with symbols", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "ADMIN+other@example.com", password: "otherPassword"})
      .expect(200);
    assert.isDefined(res.body.data.token);
  });

  it("completes token login e2e", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);
    const {userId, token} = res.body.data;
    assert.isDefined(userId);
    assert.isDefined(token);

    await agent.set("authorization", `Bearer ${res.body.data.token}`);

    const meRes = await agent.get("/auth/me").expect(200);
    assert.isDefined(meRes.body.data._id);
    assert.isDefined(meRes.body.data.id);
    assert.isUndefined(meRes.body.data.hash);
    assert.equal(meRes.body.data.email, "admin@example.com");
    assert.isDefined(meRes.body.data.updated);
    assert.isDefined(meRes.body.data.created);
    assert.isTrue(meRes.body.data.admin);

    const mePatchRes = await agent
      .patch("/auth/me")
      .send({email: "admin2@example.com"})
      .expect(200);
    assert.isDefined(mePatchRes.body.data._id);
    assert.isDefined(mePatchRes.body.data.id);
    assert.isUndefined(mePatchRes.body.data.hash);
    assert.equal(mePatchRes.body.data.email, "admin2@example.com");
    assert.isDefined(mePatchRes.body.data.updated);
    assert.isDefined(mePatchRes.body.data.created);
    assert.isTrue(mePatchRes.body.data.admin);

    // Use token to see admin foods
    const getRes = await agent.get("/food").expect(200);

    assert.lengthOf(getRes.body.data, 3);
    const food = getRes.body.data.find((f: any) => f.name === "Apple");
    assert.isDefined(food);

    const updateRes = await agent
      .patch(`/food/${food.id}`)
      .set("authorization", `Bearer ${token}`)
      .send({name: "Apple Pie"})
      .expect(200);
    assert.equal(updateRes.body.data.name, "Apple Pie");
  });

  it("login successfully and tokens expire", async () => {
    const res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(200);
    const {userId, token} = res.body.data;
    assert.isDefined(userId);
    assert.isDefined(token);

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

    assert.deepEqual(res.body, {
      message: "Password or username is incorrect",
    });
    let user = await UserModel.findById(admin._id);
    assert.equal((user as any)?.attempts, 1);
    res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);

    assert.deepEqual(res.body, {
      message: "Password or username is incorrect",
    });
    user = await UserModel.findById(admin._id);
    assert.equal((user as any)?.attempts, 2);
    res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "wrong"})
      .expect(401);

    assert.deepEqual(res.body, {
      message: "Account locked due to too many failed login attempts",
    });
    user = await UserModel.findById(admin._id);
    assert.equal((user as any)?.attempts, 3);

    // Logging in with correct password fails because account is locked
    res = await agent
      .post("/auth/login")
      .send({email: "admin@example.com", password: "securePassword"})
      .expect(401);

    assert.deepEqual(res.body, {
      message: "Account locked due to too many failed login attempts",
    });
    user = await UserModel.findById(admin._id);
    // Not incremented
    assert.equal((user as any)?.attempts, 3);
  });

  it("refresh token allows refresh of auth token", async () => {
    // initial login
    const initialLoginRes = await agent
      .post("/auth/login")
      .send({email: "ADMIN@example.com", password: "securePassword"})
      .expect(200);
    assert.isDefined(initialLoginRes.body.data.token);
    assert.isDefined(initialLoginRes.body.data.refreshToken);
    const initialToken = initialLoginRes.body.data.token;
    await agent.set("authorization", `Bearer ${initialToken}`);

    // get new auth token from refresh token
    const refreshRes = await agent
      .post("/auth/refresh_token")
      .send({refreshToken: initialLoginRes.body.data.refreshToken})
      .expect(200);
    assert.isDefined(refreshRes.body.data.token);
    assert.isDefined(refreshRes.body.data.refreshToken);
    const newToken = refreshRes.body.data.token;
    // note that new token will most likely be the same as the old token because
    // an HMAC signature will always be the same for a header + payload combination that is equal.

    // make sure new token works
    await agent.set("authorization", `Bearer ${newToken}`);
    const meRes = await agent.get("/auth/me").expect(200);
    assert.isDefined(meRes.body.data._id);
  });

  it("disabled user fails", async () => {
    // initial login
    const initialLoginRes = await agent
      .post("/auth/login")
      .send({email: "ADMIN@example.com", password: "securePassword"})
      .expect(200);
    assert.isDefined(initialLoginRes.body.data.token);
    assert.isDefined(initialLoginRes.body.data.refreshToken);
    const initialToken = initialLoginRes.body.data.token;
    await agent.set("authorization", `Bearer ${initialToken}`);
    const meRes = await agent.get("/auth/me").expect(200);
    assert.isDefined(meRes.body.data._id);

    admin.disabled = true;
    await admin.save();

    const failRes = await agent.get("/auth/me").expect(401);
    assert.deepEqual(failRes.body, {status: 401, title: "User is disabled"});
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
    assert.equal(res2.body.title, "A user with the given username is already registered");
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

    assert.isDefined(res.body.data.userId);
    assert.isDefined(res.body.data.token);

    await adminAgent.set("authorization", `Bearer ${res.body.data.token}`);

    // login non-admin and set token
    const notAdminAgent = supertest.agent(app);
    const res2 = await notAdminAgent
      .post("/auth/login")
      .send({email: "notadmin@example.com", password: "password"})
      .expect(200);

    assert.isDefined(res2.body.data.userId);
    assert.isDefined(res2.body.data.token);

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
