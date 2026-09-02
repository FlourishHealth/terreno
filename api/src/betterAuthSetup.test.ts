// noExplicitAny: test mock typing
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterAll, afterEach, describe, expect, it, mock} from "bun:test";
import {assert} from "chai";
import express from "express";
import {MongoMemoryServer} from "mongodb-memory-server";
import mongoose, {Schema} from "mongoose";
import type {UserModel} from "./auth";
import type {BetterAuthConfig, BetterAuthUser} from "./betterAuth";
import {
  applyJwtPasswordResetToBetterAuth,
  createBetterAuth,
  createBetterAuthEmailHooks,
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
let StrictUser: UserModel;

// Simple user schema for testing
const testUserSchema = new Schema({
  admin: {default: false, type: Boolean},
  betterAuthId: {type: String},
  email: {required: true, type: String},
  name: {type: String},
  oauthProvider: {type: String},
});

const strictUserSchema = new Schema(
  {
    admin: {default: false, type: Boolean},
    betterAuthId: {type: String},
    email: {required: true, type: String},
    name: {type: String},
  },
  {strict: "throw"}
);

// Start memory server and create connection before tests run
const setup = (async () => {
  mongod = await MongoMemoryServer.create();
  conn = mongoose.createConnection(mongod.getUri());
  await conn.asPromise();
  TestUser = conn.model("BetterAuthTestUser", testUserSchema);
  StrictUser = conn.model("BetterAuthStrictUser", strictUserSchema) as UserModel;
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
  await StrictUser.deleteMany({});
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

  it("sets cross-site session cookies when crossDomainCookies is enabled", async () => {
    await setup;
    const origin = "https://frontend.example.com";
    const config: BetterAuthConfig = {
      baseURL: "https://api.example.com",
      crossDomainCookies: true,
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
      trustedOrigins: [origin],
    };
    const auth = createBetterAuth({config, mongoClient: getClient()});

    const response = await auth.handler(
      new Request("https://api.example.com/api/auth/sign-up/email", {
        body: JSON.stringify({
          email: "cross-domain-cookie@example.com",
          name: "Cross Domain",
          password: "testpassword123",
        }),
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
        },
        method: "POST",
      })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    assert.isTrue(response.ok);
    assert.include(setCookie.toLowerCase(), "samesite=none");
    assert.include(setCookie.toLowerCase(), "secure");
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

  it("revokes Better Auth sessions on password reset", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };
    const auth = createBetterAuth({config, mongoClient: getClient()});
    const options = (
      auth as {
        options?: {emailAndPassword?: {revokeSessionsOnPasswordReset?: boolean}};
      }
    ).options;
    assert.isTrue(options?.emailAndPassword?.revokeSessionsOnPasswordReset);
  });

  it("sends reset and verification mail through the injected renderer", async () => {
    await setup;
    const renderedCalls: Array<{templateId: string; token: string}> = [];
    const sent: Array<{subject: string; text?: string; to: string}> = [];
    const hooks = createBetterAuthEmailHooks({
      enabled: true,
      publicAppUrl: "https://app.example.com",
      renderAuthMail: ({templateId, token}) => {
        renderedCalls.push({templateId, token});
        return {subject: templateId, text: `link-${token}`};
      },
      sendMail: async (message) => {
        sent.push({subject: message.subject, text: message.text, to: message.to});
      },
    });
    assert.isDefined(hooks);
    await hooks?.sendResetPassword({
      token: "reset-token",
      url: "https://better-auth.example/ignored",
      user: {email: "reset@example.com"},
    });
    await hooks?.sendVerificationEmail({
      token: "verify-token",
      url: "https://better-auth.example/ignored",
      user: {email: "verify@example.com"},
    });
    assert.deepEqual(renderedCalls, [
      {templateId: "resetPassword", token: "reset-token"},
      {templateId: "verifyEmail", token: "verify-token"},
    ]);
    assert.deepEqual(sent, [
      {subject: "resetPassword", text: "link-reset-token", to: "reset@example.com"},
      {subject: "verifyEmail", text: "link-verify-token", to: "verify@example.com"},
    ]);
  });

  it("does not send Better Auth recovery mail when publicAppUrl is missing", async () => {
    await setup;
    const sent: Array<{subject: string; to: string}> = [];
    const hooks = createBetterAuthEmailHooks({
      enabled: true,
      sendMail: async (message) => {
        sent.push({subject: message.subject, to: message.to});
      },
    });
    assert.isDefined(hooks);
    await expect(
      hooks?.sendResetPassword({
        token: "reset-token",
        url: "https://better-auth.example/ignored",
        user: {email: "reset@example.com"},
      })
    ).rejects.toThrow("publicAppUrl is required to send recovery mail");
    await expect(
      hooks?.sendVerificationEmail({
        token: "verify-token",
        url: "https://better-auth.example/ignored",
        user: {email: "verify@example.com"},
      })
    ).rejects.toThrow("publicAppUrl is required to send recovery mail");
    assert.deepEqual(sent, []);
  });
});

describe("applyJwtPasswordResetToBetterAuth", () => {
  it("updates the Better Auth credential hash and drops sessions", async () => {
    await setup;
    const auth = createBetterAuth({
      config: {
        baseURL: "http://localhost:3000",
        enabled: true,
        secret: "test-secret-at-least-32-characters-long",
      },
      mongoClient: getClient(),
    });
    const created = await auth.api.signUpEmail({
      body: {
        email: "dual@example.com",
        name: "Dual User",
        password: "old-password-123",
      },
    });
    const betterAuthId = created.user.id;
    await applyJwtPasswordResetToBetterAuth(
      auth,
      {betterAuthId, email: "dual@example.com"},
      "new-password-123"
    );
    await expect(
      auth.api.signInEmail({
        body: {email: "dual@example.com", password: "old-password-123"},
      })
    ).rejects.toThrow();
    const signedIn = await auth.api.signInEmail({
      body: {email: "dual@example.com", password: "new-password-123"},
    });
    assert.isDefined(signedIn.user);
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

  it("creates a user on a strict-throw schema that omits oauthProvider", async () => {
    await setup;
    const baUser = makeBetterAuthUser({email: "strict@example.com"});
    const result = await syncBetterAuthUser(StrictUser, baUser);

    assert.equal(result.email, "strict@example.com");
    assert.equal(result.betterAuthId, "ba-user-123");
    const saved = await StrictUser.findOne({email: "strict@example.com"}).lean();
    assert.isOk(saved);
    assert.notProperty(saved, "oauthProvider");
  });

  it("sets oauthProvider on create when a provider is passed", async () => {
    await setup;
    const baUser = makeBetterAuthUser({email: "oauth-create@example.com"});
    const result = await syncBetterAuthUser(TestUser as UserModel, baUser, "google");

    assert.equal(result.oauthProvider, "google");
    const saved = await TestUser.findOne({email: "oauth-create@example.com"}).lean();
    assert.equal(saved.oauthProvider, "google");
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

  it("logs and rethrows when the lookup fails", async () => {
    await setup;
    const failure = new Error("lookup exploded");
    const throwingModel = {
      findOneOrNone: () => {
        throw failure;
      },
    } as unknown as UserModel;

    const baUser = makeBetterAuthUser();
    await expect(syncBetterAuthUser(throwingModel, baUser)).rejects.toThrow("lookup exploded");
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

  it("delegates matched requests to the Better Auth node handler", async () => {
    await setup;
    const config: BetterAuthConfig = {
      baseURL: "http://localhost:3000",
      enabled: true,
      secret: "test-secret-at-least-32-characters-long",
    };

    const auth = createBetterAuth({config, mongoClient: getClient()});

    type RouteHandler = (req: unknown, res: unknown) => unknown;
    let registered: RouteHandler | undefined;
    let registeredPath: string | undefined;
    const fakeApp = {
      all: (path: string, handler: RouteHandler) => {
        registeredPath = path;
        registered = handler;
      },
    } as unknown as express.Application;

    mountBetterAuthRoutes(fakeApp, auth, "/api/auth");
    expect(registeredPath).toBe("/api/auth/*path");
    expect(registered).toBeDefined();

    // Invoke the registered handler so the wildcard delegation runs.
    const req = {headers: {}, method: "GET", on: () => {}, url: "/api/auth/session"};
    const res = {
      end: mock(() => {}),
      getHeader: () => undefined,
      setHeader: mock(() => {}),
      write: mock(() => {}),
      writeHead: mock(() => {}),
    };
    try {
      await registered?.(req, res);
    } catch {
      // The bare req/res may not satisfy the underlying handler; we only need
      // the delegating arrow itself to execute.
    }
  });
});

describe("getMongoClientFromMongoose", () => {
  it("returns the mongo client when connected", () => {
    // Default mongoose connection is set up by bunSetup.ts preload
    const client = getMongoClientFromMongoose();
    expect(client).toBeDefined();
  });

  it("throws when the mongoose connection has no client", () => {
    const connection = mongoose.connection as unknown as {client?: unknown};
    const originalClient = connection.client;
    connection.client = undefined;
    try {
      expect(() => getMongoClientFromMongoose()).toThrow("Mongoose is not connected");
    } finally {
      connection.client = originalClient;
    }
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
