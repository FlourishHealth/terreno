import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import type {Application} from "express";
import supertest from "supertest";

import {modelRouter} from "../api";
import type {UserModel as AuthUserModel} from "../auth";
import {Permissions} from "../permissions";
import {TerrenoApp} from "../terrenoApp";
import {FoodModel, setupTestData, UserModel} from "../tests";
import {createRateLimitStore} from "./createStore";
import {createMemoryRateLimitStore} from "./memoryStore";
import {classifyRateLimitPolicy, shouldSkipRateLimit} from "./policies";
import {DEFAULT_API_MAX, DEFAULT_AUTH_MAX, type RateLimitOptions} from "./types";

const foodRouter = modelRouter("/food", FoodModel, {
  allowAnonymous: true,
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [],
    list: [Permissions.IsAny],
    read: [Permissions.IsAny],
    update: [],
  },
});

const buildApp = (rateLimit?: RateLimitOptions): Application => {
  return new TerrenoApp({
    configureApp: (app) => {
      app.get("/health", (_req, res) => {
        res.json({ok: true});
      });
    },
    logRequests: false,
    rateLimit,
    skipListen: true,
    userModel: UserModel as unknown as AuthUserModel,
  })
    .register(foodRouter)
    .start();
};

describe("HTTP rate limiting", () => {
  beforeEach(async () => {
    await setupTestData();
  });

  it("does not 429 burst logins when rateLimit is omitted", async () => {
    const app = buildApp();
    for (let i = 0; i < 25; i++) {
      const res = await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"});
      assert.equal(res.status, 200, `login ${i} should succeed without a limiter`);
    }
  });

  it("returns 429 on the 21st POST /auth/login with default auth max", async () => {
    const app = buildApp({});
    for (let i = 0; i < DEFAULT_AUTH_MAX; i++) {
      const res = await supertest(app)
        .post("/auth/login")
        .send({email: "notAdmin@example.com", password: "password"});
      assert.equal(res.status, 200, `login ${i} should be under the auth cap`);
    }
    const limited = await supertest(app)
      .post("/auth/login")
      .send({email: "notAdmin@example.com", password: "password"});
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "rate-limit-exceeded");
    assert.equal(limited.body.title, "Too many requests");
    assert.equal(limited.body.status, 429);
    assert.isString(limited.headers["retry-after"]);
    assert.include(limited.headers.ratelimit, "limit=20");
    assert.include(limited.headers["ratelimit-policy"], "20;w=");

    const list = await supertest(app).get("/food");
    assert.equal(list.status, 200, "api bucket still has remaining after auth cap");
  });

  it("returns 429 on the request after apiMax on modelRouter list", async () => {
    const app = buildApp({limits: {apiMax: 3, authMax: 20}});
    for (let i = 0; i < 3; i++) {
      const res = await supertest(app).get("/food");
      assert.equal(res.status, 200, `list ${i} should be under apiMax`);
    }
    const limited = await supertest(app).get("/food");
    assert.equal(limited.status, 429);
    assert.include(limited.headers.ratelimit, "limit=3");
  });

  it("never rate-limits GET /health", async () => {
    const app = buildApp({limits: {apiMax: 1, authMax: 1}});
    const first = await supertest(app).get("/health");
    assert.equal(first.status, 200);
    const second = await supertest(app).get("/health");
    assert.equal(second.status, 200);
  });

  it("defaults api max to 600 and denies the 601st consume", async () => {
    const store = createMemoryRateLimitStore();
    const now = 5_000_000;
    for (let i = 0; i < DEFAULT_API_MAX; i++) {
      const result = await store.consume({
        key: "api:ip:1",
        max: DEFAULT_API_MAX,
        now,
        windowMs: 60_000,
      });
      assert.isTrue(result.allowed);
    }
    const over = await store.consume({
      key: "api:ip:1",
      max: DEFAULT_API_MAX,
      now: now + 1,
      windowMs: 60_000,
    });
    assert.isFalse(over.allowed);
  });

  it("classifies login as auth and /auth/me as api", () => {
    assert.equal(
      classifyRateLimitPolicy({method: "POST", originalUrl: "/auth/login"} as never),
      "auth"
    );
    assert.equal(classifyRateLimitPolicy({method: "GET", originalUrl: "/auth/me"} as never), "api");
    assert.equal(
      classifyRateLimitPolicy({method: "GET", originalUrl: "/auth/github"} as never),
      "auth"
    );
    assert.equal(
      classifyRateLimitPolicy({
        method: "POST",
        originalUrl: "/api/auth/sign-in/email",
      } as never),
      "auth"
    );
    assert.isTrue(shouldSkipRateLimit({method: "GET", originalUrl: "/openapi.json"} as never));
    assert.isTrue(shouldSkipRateLimit({method: "GET", originalUrl: "/swagger"} as never));
  });

  it("rejects an unknown store name at create time", () => {
    try {
      createRateLimitStore({store: "disk" as never});
      assert.fail("expected unknown store to throw");
    } catch (error) {
      assert.include(String(error), "Unknown rate limit store");
    }
  });
});

describe("memory rate limit store", () => {
  it("isolates keys and resets after the window", async () => {
    const store = createMemoryRateLimitStore();
    const t0 = 1_000_000;
    const a1 = await store.consume({key: "a", max: 2, now: t0, windowMs: 1000});
    const a2 = await store.consume({key: "a", max: 2, now: t0 + 10, windowMs: 1000});
    const a3 = await store.consume({key: "a", max: 2, now: t0 + 20, windowMs: 1000});
    const b1 = await store.consume({key: "b", max: 2, now: t0, windowMs: 1000});
    assert.isTrue(a1.allowed);
    assert.isTrue(a2.allowed);
    assert.isFalse(a3.allowed);
    assert.isTrue(b1.allowed);
    const after = await store.consume({key: "a", max: 2, now: t0 + 1001, windowMs: 1000});
    assert.isTrue(after.allowed);
  });
});
