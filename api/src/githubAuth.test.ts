import {afterEach, beforeEach, describe, expect, it, setSystemTime} from "bun:test";
import type express from "express";
import mongoose, {model, Schema} from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {setupServer} from "./expressServer";
import {type GitHubUserFields, githubUserPlugin} from "./githubAuth";
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
  admin: {default: false, type: Boolean},
  name: String,
  username: String,
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
    await mongoose.connect("mongodb://127.0.0.1/terreno?&connectTimeoutMS=360000").catch(logger.catch);
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

    // User has both auth methods
    const updatedUser = await GitHubTestUserModel.findOne({email: "test@example.com"});
    expect((updatedUser as any).hash).toBeDefined();
    expect((updatedUser as any).githubId).toBe("88888");
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
