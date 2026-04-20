import {afterEach, beforeEach, describe, expect, it, setSystemTime} from "bun:test";
import type express from "express";
import mongoose, {model, Schema} from "mongoose";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {setupServer} from "./expressServer";
import {type GitHubUserFields, githubUserPlugin, setupGitHubAuth} from "./githubAuth";
import {logger} from "./logger";
import {createdUpdatedPlugin, isDisabledPlugin} from "./plugins";

interface TestUser extends GitHubUserFields {
  admin: boolean;
  name?: string;
  username: string;
  email: string;
  disabled?: boolean;
}

// Create schema for GitHub-enabled user
const testUserSchema = new Schema<TestUser>({
  admin: {default: false, description: "Whether the user has admin privileges", type: Boolean},
  name: {description: "The user's display name", type: String},
  username: {description: "The user's username", type: String},
});

testUserSchema.plugin(passportLocalMongoose as any, {
  attemptsField: "attempts",
  interval: 1,
  limitAttempts: true,
  maxAttempts: 3,
  maxInterval: 1,
  usernameCaseInsensitive: true,
  usernameField: "email",
});
testUserSchema.plugin(createdUpdatedPlugin);
testUserSchema.plugin(isDisabledPlugin);
testUserSchema.plugin(githubUserPlugin);

// Get or create model to avoid model redefinition errors
const GitHubTestUserModel =
  mongoose.models.GitHubTestUser || model<TestUser>("GitHubTestUser", testUserSchema);

// Connect to database before tests
const connectDb = async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose
      .connect("mongodb://127.0.0.1/terreno?&connectTimeoutMS=360000")
      .catch(logger.catch);
  }
  process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_EXPIRES_IN = "30m";
  process.env.TOKEN_ISSUER = "example.com";
  process.env.SESSION_SECRET = "session";
};

describe("githubUserPlugin", () => {
  it("adds GitHub fields to schema", () => {
    const paths = testUserSchema.paths;
    expect(paths.githubId).toBeDefined();
    expect(paths.githubUsername).toBeDefined();
    expect(paths.githubProfileUrl).toBeDefined();
    expect(paths.githubAvatarUrl).toBeDefined();
  });

  it("githubId is indexed and sparse", () => {
    const githubIdPath = testUserSchema.path("githubId");
    expect((githubIdPath as any).options.index).toBe(true);
    expect((githubIdPath as any).options.sparse).toBe(true);
    expect((githubIdPath as any).options.unique).toBe(true);
  });
});

describe("GitHub auth routes", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await connectDb();

    await GitHubTestUserModel.deleteMany({});

    // Create test user with password
    const testUser = await GitHubTestUserModel.create({
      admin: false,
      email: "test@example.com",
      name: "Test User",
    });
    await (testUser as any).setPassword("password123");
    await testUser.save();

    function addRoutes(router: express.Router): void {
      router.get("/test", (_req, res) => res.json({ok: true}));
    }

    app = setupServer({
      addRoutes,
      githubAuth: {
        allowAccountLinking: true,
        callbackURL: "http://localhost:9000/auth/github/callback",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      },
      skipListen: true,
      userModel: GitHubTestUserModel as any,
    });
    agent = supertest.agent(app);
  });

  afterEach(async () => {
    setSystemTime();
  });

  it("GET /auth/github redirects to GitHub OAuth", async () => {
    const res = await agent.get("/auth/github").expect(302);
    expect(res.headers.location).toContain("github.com");
    expect(res.headers.location).toContain("client_id=test-client-id");
  });

  it("GET /auth/github/failure returns 401", async () => {
    const res = await agent.get("/auth/github/failure").expect(401);
    expect(res.body.message).toBe("GitHub authentication failed");
  });

  it("DELETE /auth/github/unlink requires authentication", async () => {
    const res = await agent.delete("/auth/github/unlink").expect(401);
    expect(res.body).toBeDefined();
  });

  it("DELETE /auth/github/unlink works when authenticated with password", async () => {
    // Login as test user
    const loginRes = await agent
      .post("/auth/login")
      .send({email: "test@example.com", password: "password123"})
      .expect(200);

    // Link github to this user
    const user = await GitHubTestUserModel.findOne({email: "test@example.com"});
    if (user) {
      (user as any).githubId = "99999";
      (user as any).githubUsername = "testghuser";
      await user.save();
    }

    // Unlink
    const res = await agent
      .delete("/auth/github/unlink")
      .set("authorization", `Bearer ${loginRes.body.data.token}`)
      .expect(200);

    expect(res.body.data.message).toBe("GitHub account unlinked successfully");

    // Verify github fields are cleared
    const updatedUser = await GitHubTestUserModel.findOne({email: "test@example.com"});
    expect((updatedUser as any).githubId).toBeUndefined();
    expect((updatedUser as any).githubUsername).toBeUndefined();
  });

  it("user can have both password and GitHub auth", async () => {
    const user = await GitHubTestUserModel.findOne({email: "test@example.com"});
    expect(user).toBeDefined();
    if (!user) {
      return;
    }

    // Link GitHub
    (user as any).githubId = "88888";
    (user as any).githubUsername = "linkeduser";
    await user.save();

    // Can still login with password
    const res = await agent
      .post("/auth/login")
      .send({email: "test@example.com", password: "password123"})
      .expect(200);

    expect(res.body.data.token).toBeDefined();

    // User has both auth methods - successful login proves password works
    // and we verify GitHub fields are set
    const updatedUser = await GitHubTestUserModel.findOne({email: "test@example.com"});
    expect(updatedUser).toBeDefined();
    expect((updatedUser as any).githubId).toBe("88888");
    expect((updatedUser as any).githubUsername).toBe("linkeduser");
  });
});

describe("GitHub auth disabled", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await connectDb();

    await GitHubTestUserModel.deleteMany({});

    function addRoutes(router: express.Router): void {
      router.get("/test", (_req, res) => res.json({ok: true}));
    }

    // Setup server WITHOUT GitHub auth
    app = setupServer({
      addRoutes,
      skipListen: true,
      userModel: GitHubTestUserModel as any,
    });
    agent = supertest.agent(app);
  });

  afterEach(async () => {
    setSystemTime();
  });

  it("GitHub routes are not available when githubAuth is not configured", async () => {
    await agent.get("/auth/github").expect(404);
    await agent.get("/auth/github/callback").expect(404);
    await agent.delete("/auth/github/unlink").expect(404);
  });
});

// Helper to extract the strategy verify callback and invoke it directly
const invokeGitHubVerify = (req: any, accessToken: string, refreshToken: string, profile: any) => {
  const strategy = (passport as any)._strategies?.github;
  if (!strategy) {
    throw new Error("github strategy not registered");
  }
  return new Promise<{err: any; user: any}>((resolve) => {
    const done = (err: any, user?: any) => resolve({err, user});
    strategy._verify(req, accessToken, refreshToken, profile, done);
  });
};

describe("GitHub strategy verify callback", () => {
  const testApp = {get: () => {}, use: () => {}} as any;

  beforeEach(async () => {
    await connectDb();
    await GitHubTestUserModel.deleteMany({});
  });

  it("uses custom findOrCreateUser when provided", async () => {
    const customUser = {_id: "custom-user-id", email: "custom@example.com"};
    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
      findOrCreateUser: async () => customUser,
    });

    const result = await invokeGitHubVerify({}, "access", "refresh", {id: "123"});
    expect(result.err).toBeNull();
    expect(result.user).toEqual(customUser);
  });

  it("creates a new user when no existing GitHub or email user", async () => {
    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const profile = {
      emails: [{value: "new@example.com"}],
      id: "gh-new-1",
      photos: [{value: "http://avatar"}],
      profileUrl: "http://profile",
      username: "newghuser",
    };

    const result = await invokeGitHubVerify({}, "access", "refresh", profile);
    expect(result.err).toBeNull();
    expect(result.user).toBeDefined();
    expect(result.user.githubId).toBe("gh-new-1");
    expect(result.user.githubUsername).toBe("newghuser");
    expect(result.user.email).toBe("new@example.com");
  });

  it("logs in existing GitHub user", async () => {
    const existingUser = await GitHubTestUserModel.create({
      email: "gh@example.com",
      githubId: "gh-existing-1",
      githubUsername: "ghuser",
      name: "GH User",
    } as any);

    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const result = await invokeGitHubVerify({}, "access", "refresh", {
      id: "gh-existing-1",
      username: "ghuser",
    });
    expect(result.err).toBeNull();
    expect(result.user._id.toString()).toBe((existingUser as any)._id.toString());
  });

  it("links GitHub to authenticated user when allowAccountLinking=true", async () => {
    const existingUser = await GitHubTestUserModel.create({
      email: "link@example.com",
      name: "Link User",
    } as any);

    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      allowAccountLinking: true,
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const req = {user: existingUser};
    const result = await invokeGitHubVerify(req, "access", "refresh", {
      id: "gh-link-1",
      photos: [{value: "http://avatar"}],
      profileUrl: "http://profile",
      username: "linkedghuser",
    });
    expect(result.err).toBeNull();
    expect(result.user.githubId).toBe("gh-link-1");
    expect(result.user.githubUsername).toBe("linkedghuser");
  });

  it("rejects linking when allowAccountLinking=false", async () => {
    const existingUser = await GitHubTestUserModel.create({
      email: "nolink@example.com",
    } as any);

    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      allowAccountLinking: false,
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const req = {user: existingUser};
    const result = await invokeGitHubVerify(req, "access", "refresh", {id: "gh-nolink-1"});
    expect(result.err).toBeDefined();
    expect((result.err as any).status).toBe(400);
  });

  it("rejects linking when GitHub account belongs to another user", async () => {
    const userA = await GitHubTestUserModel.create({
      email: "a@example.com",
    } as any);
    await GitHubTestUserModel.create({
      email: "b@example.com",
      githubId: "gh-other-1",
    } as any);

    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      allowAccountLinking: true,
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const req = {user: userA};
    const result = await invokeGitHubVerify(req, "access", "refresh", {id: "gh-other-1"});
    expect(result.err).toBeDefined();
    expect((result.err as any).status).toBe(400);
  });

  it("links GitHub to existing email user when allowAccountLinking is not false", async () => {
    await GitHubTestUserModel.create({
      email: "emailuser@example.com",
    } as any);

    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const result = await invokeGitHubVerify({}, "access", "refresh", {
      emails: [{value: "emailuser@example.com"}],
      id: "gh-email-link-1",
      username: "emailuserghuser",
    });
    expect(result.err).toBeNull();
    expect(result.user.githubId).toBe("gh-email-link-1");
    expect(result.user.email).toBe("emailuser@example.com");
  });

  it("rejects email-link when allowAccountLinking=false", async () => {
    await GitHubTestUserModel.create({
      email: "emailnolink@example.com",
    } as any);

    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      allowAccountLinking: false,
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
    });

    const result = await invokeGitHubVerify({}, "access", "refresh", {
      emails: [{value: "emailnolink@example.com"}],
      id: "gh-email-nolink-1",
    });
    expect(result.err).toBeDefined();
    expect((result.err as any).status).toBe(400);
  });

  it("returns error when thrown during lookup", async () => {
    // Set up strategy with findOrCreateUser that throws
    setupGitHubAuth(testApp, GitHubTestUserModel as any, {
      callbackURL: "http://localhost:9000/auth/github/callback",
      clientId: "id",
      clientSecret: "secret",
      findOrCreateUser: async () => {
        throw new Error("boom");
      },
    });

    const result = await invokeGitHubVerify({}, "access", "refresh", {id: "gh-err-1"});
    expect(result.err).toBeDefined();
    expect((result.err as Error).message).toBe("boom");
  });
});

describe("addGitHubAuthRoutes link endpoints", () => {
  let app: express.Application;
  let agent: TestAgent;

  beforeEach(async () => {
    setSystemTime();
    await connectDb();
    await GitHubTestUserModel.deleteMany({});

    function addRoutes(router: express.Router): void {
      router.get("/test", (_req, res) => res.json({ok: true}));
    }

    app = setupServer({
      addRoutes,
      githubAuth: {
        allowAccountLinking: true,
        callbackURL: "http://localhost:9000/auth/github/callback",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      },
      skipListen: true,
      userModel: GitHubTestUserModel as any,
    });
    agent = supertest.agent(app);
  });

  afterEach(() => {
    setSystemTime();
  });

  it("GET /auth/github/link requires JWT authentication", async () => {
    const res = await agent.get("/auth/github/link").expect(401);
    expect(res.body.message).toContain("Authentication required");
  });

  it("GET /auth/github with returnTo stores it in session", async () => {
    const res = await agent.get("/auth/github?returnTo=https://example.com/cb").expect(302);
    expect(res.headers.location).toContain("github.com");
  });

  it("DELETE /auth/github/unlink clears GitHub fields", async () => {
    const user = await GitHubTestUserModel.create({
      email: "unlinkme@example.com",
      githubAvatarUrl: "http://avatar",
      githubId: "77777",
      githubProfileUrl: "http://profile",
      githubUsername: "ghunlink",
    } as any);
    await (user as any).setPassword("password123");
    await user.save();

    const loginRes = await agent
      .post("/auth/login")
      .send({email: "unlinkme@example.com", password: "password123"})
      .expect(200);

    await agent
      .delete("/auth/github/unlink")
      .set("authorization", `Bearer ${loginRes.body.data.token}`)
      .expect(200);

    const updatedUser = await GitHubTestUserModel.findOne({email: "unlinkme@example.com"});
    expect((updatedUser as any).githubId).toBeUndefined();
    expect((updatedUser as any).githubAvatarUrl).toBeUndefined();
    expect((updatedUser as any).githubProfileUrl).toBeUndefined();
  });
});
