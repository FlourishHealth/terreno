import {afterAll, afterEach, describe, expect, it, mock} from "bun:test";
import express from "express";
import {MongoMemoryServer} from "mongodb-memory-server";
import mongoose, {Schema} from "mongoose";
import type {UserModel} from "./auth";
import type {BetterAuthConfig, BetterAuthUser} from "./betterAuth";
import {
  createBetterAuth,
  createBetterAuthSessionMiddleware,
  getBetterAuthSession,
  getMongoClientFromMongoose,
  hasBetterAuthSession,
  mountBetterAuthRoutes,
  setupBetterAuthUserSync,
  syncBetterAuthUser,
} from "./betterAuthSetup";

// Use a separate connection to avoid conflict with bunSetup.ts preload
let conn: mongoose.Connection;
let mongod: MongoMemoryServer;
let TestUser: any;

// Simple user schema for testing
const testUserSchema = new Schema({
  admin: {default: false, type: Boolean},
  betterAuthId: {type: String},
  email: {required: true, type: String},
  name: {type: String},
  oauthProvider: {type: String},
});

// Start memory server and create connection before tests run
const setup = (async () => {
  mongod = await MongoMemoryServer.create();
  conn = mongoose.createConnection(mongod.getUri());
  await conn.asPromise();
  TestUser = conn.model("BetterAuthTestUser", testUserSchema);
})();

// Helper to get the mongo client from our separate connection
const getClient = () => (conn as any).client;

afterAll(async () => {
  await conn?.close();
  await mongod?.stop();
});

afterEach(async () => {
  await setup;
  await TestUser.deleteMany({});
});

describe("createBetterAuth", () => {
  it("throws if secret is not provided", async () => {
    await setup;
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_SECRET;

    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
    };

    expect(() => createBetterAuth({config, mongoClient: getClient()})).toThrow(
      "BETTER_AUTH_SECRET must be set"
    );

    process.env.BETTER_AUTH_SECRET = originalSecret;
  });

  it("throws if baseURL is not provided", async () => {
    await setup;
    const originalUrl = process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_URL;

    const config: BetterAuthConfig = {
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    expect(() => createBetterAuth({config, mongoClient: getClient()})).toThrow(
      "BETTER_AUTH_URL must be set"
    );

    process.env.BETTER_AUTH_URL = originalUrl;
  });

  it("creates a Better Auth instance with valid config", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    expect(auth).toBeDefined();
    expect(auth.api).toBeDefined();
  });

  it("creates instance with social providers", async () => {
    await setup;
    const config: BetterAuthConfig = {
      appleOAuth: {clientId: "apple-id", clientSecret: "apple-secret"},
      baseURL: "http://localhost:3000",
      enabled: true,
      githubOAuth: {clientId: "github-id", clientSecret: "github-secret"},
      googleOAuth: {clientId: "google-id", clientSecret: "google-secret"},
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    expect(auth).toBeDefined();
  });

  it("uses env vars as fallback for secret and baseURL", async () => {
    await setup;
    process.env.BETTER_AUTH_SECRET = "env-secret-at-least-32-characters-long";
    process.env.BETTER_AUTH_URL = "http://localhost:4000";

    const config: BetterAuthConfig = {enabled: true};
    const auth = createBetterAuth({config, mongoClient: getClient()});

    expect(auth).toBeDefined();

    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
  });

  it("uses custom basePath when provided", async () => {
    await setup;
    const config: BetterAuthConfig = {
      basePath: "/custom/auth",
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});
    expect(auth).toBeDefined();
  });
});

describe("syncBetterAuthUser", () => {
  const makeBetterAuthUser = (overrides: Partial<BetterAuthUser> = {}): BetterAuthUser => ({
    createdAt: new Date(),
    email: "test@example.com",
    emailVerified: true,
    id: "ba-user-123",
    image: null,
    name: "Test User",
    updatedAt: new Date(),
    ...overrides,
  });

  it("creates a new user when none exists", async () => {
    await setup;
    const baUser = makeBetterAuthUser();
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser);

    expect(result).toBeDefined();
    expect(result.email).toBe("test@example.com");
    expect(result.name).toBe("Test User");
    expect(result.betterAuthId).toBe("ba-user-123");
    expect(result.admin).toBe(false);
  });

  it("updates an existing user matched by betterAuthId", async () => {
    await setup;
    await TestUser.create({
      betterAuthId: "ba-user-123",
      email: "old@example.com",
      name: "Old Name",
    });

    const baUser = makeBetterAuthUser({email: "new@example.com", name: "New Name"});
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser);

    expect(result.email).toBe("new@example.com");
    expect(result.name).toBe("New Name");
    expect(result.betterAuthId).toBe("ba-user-123");

    const count = await TestUser.countDocuments();
    expect(count).toBe(1);
  });

  it("links existing user matched by email", async () => {
    await setup;
    await TestUser.create({
      email: "test@example.com",
      name: "Existing User",
    });

    const baUser = makeBetterAuthUser();
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser);

    expect(result.betterAuthId).toBe("ba-user-123");
    expect(result.email).toBe("test@example.com");

    const count = await TestUser.countDocuments();
    expect(count).toBe(1);
  });

  it("sets oauthProvider when linking by email", async () => {
    await setup;
    await TestUser.create({
      email: "test@example.com",
      name: "Existing User",
    });

    const baUser = makeBetterAuthUser();
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser, "google");

    expect(result.oauthProvider).toBe("google");
  });

  it("uses email prefix as name when name is null", async () => {
    await setup;
    const baUser = makeBetterAuthUser({name: null});
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser);

    expect(result.name).toBe("test");
  });

  it("does not overwrite name when betterAuthUser.name is null", async () => {
    await setup;
    await TestUser.create({
      betterAuthId: "ba-user-123",
      email: "test@example.com",
      name: "Keep This Name",
    });

    const baUser = makeBetterAuthUser({name: null});
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser);

    expect(result.name).toBe("Keep This Name");
  });
});

describe("createBetterAuthSessionMiddleware", () => {
  it("calls next when no session exists", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});
    const middleware = createBetterAuthSessionMiddleware(auth);
    const req = {headers: {}} as any;
    const res = {} as any;
    const next = mock(() => {});

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
  });

  it("calls next on error without crashing", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    // Override getSession to throw
    const origGetSession = auth.api.getSession;
    (auth.api as any).getSession = () => {
      throw new Error("Session error");
    };

    const middleware = createBetterAuthSessionMiddleware(auth);
    const req = {headers: {}} as any;
    const res = {} as any;
    const next = mock(() => {});

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();

    (auth.api as any).getSession = origGetSession;
  });

  it("attaches basic user data when no userModel is provided", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    const mockSession = {
      session: {id: "session-1", userId: "user-1"},
      user: {
        email: "user@example.com",
        id: "user-1",
        name: "Test User",
      },
    };

    // Override getSession to return mock session
    (auth.api as any).getSession = async () => mockSession;

    const middleware = createBetterAuthSessionMiddleware(auth);
    const req = {headers: {}} as any;
    const res = {} as any;
    const next = mock(() => {});

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe("user@example.com");
    expect(req.user.betterAuthId).toBe("user-1");
    expect(req.user.admin).toBe(false);
    expect(req.betterAuthSession).toBe(mockSession);
  });

  it("looks up app user by betterAuthId when userModel is provided", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    // Create an existing app user
    const appUser = await TestUser.create({
      betterAuthId: "user-1",
      email: "user@example.com",
      name: "App User",
    });

    const auth = createBetterAuth({config, mongoClient: getClient()});

    const mockSession = {
      session: {id: "session-1", userId: "user-1"},
      user: {
        email: "user@example.com",
        id: "user-1",
        name: "Test User",
      },
    };

    (auth.api as any).getSession = async () => mockSession;

    const middleware = createBetterAuthSessionMiddleware(auth, TestUser as UserModel);
    const req = {headers: {}} as any;
    const res = {} as any;
    const next = mock(() => {});

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user._id.toString()).toBe(appUser._id.toString());
    expect(req.betterAuthSession).toBe(mockSession);
  });

  it("creates app user via sync when not found by betterAuthId", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    const mockSession = {
      session: {id: "session-1", userId: "new-user-1"},
      user: {
        email: "newuser@example.com",
        id: "new-user-1",
        name: "New User",
      },
    };

    (auth.api as any).getSession = async () => mockSession;

    const middleware = createBetterAuthSessionMiddleware(auth, TestUser as UserModel);
    const req = {headers: {}} as any;
    const res = {} as any;
    const next = mock(() => {});

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user.betterAuthId).toBe("new-user-1");
    expect(req.user.email).toBe("newuser@example.com");

    // Verify user was persisted
    const count = await TestUser.countDocuments();
    expect(count).toBe(1);
  });
});

describe("mountBetterAuthRoutes", () => {
  it("mounts routes at the default path", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});
    const app = express();

    expect(() => mountBetterAuthRoutes(app, auth)).not.toThrow();
  });

  it("mounts routes at a custom path", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});
    const app = express();

    expect(() => mountBetterAuthRoutes(app, auth, "/custom/auth")).not.toThrow();
  });
});

describe("getMongoClientFromMongoose", () => {
  it("returns the mongo client when connected", () => {
    // Default mongoose connection is set up by bunSetup.ts preload
    const client = getMongoClientFromMongoose();
    expect(client).toBeDefined();
  });
});

describe("getBetterAuthSession", () => {
  it("returns null when no session is set", () => {
    const req = {} as any;
    expect(getBetterAuthSession(req)).toBeNull();
  });

  it("returns session data when set", () => {
    const sessionData = {session: {id: "s1"}, user: {id: "u1"}} as any;
    const req = {betterAuthSession: sessionData} as any;
    expect(getBetterAuthSession(req)).toBe(sessionData);
  });
});

describe("hasBetterAuthSession", () => {
  it("returns false when no session is set", () => {
    const req = {} as any;
    expect(hasBetterAuthSession(req)).toBe(false);
  });

  it("returns true when session is set", () => {
    const req = {betterAuthSession: {session: {}, user: {}}} as any;
    expect(hasBetterAuthSession(req)).toBe(true);
  });
});

describe("setupBetterAuthUserSync", () => {
  it("does not throw", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    expect(() => setupBetterAuthUserSync(auth, TestUser as UserModel)).not.toThrow();
  });
});
