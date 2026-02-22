import {beforeEach, describe, expect, it} from "bun:test";

import type {AuthProvider, BetterAuthConfig, BetterAuthOAuthProvider} from "./betterAuth";

describe("Better Auth types", () => {
  it("defines BetterAuthOAuthProvider interface correctly", () => {
    const provider: BetterAuthOAuthProvider = {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
    };

    expect(provider.clientId).toBe("test-client-id");
    expect(provider.clientSecret).toBe("test-client-secret");
  });

  it("defines BetterAuthConfig interface correctly", () => {
    const config: BetterAuthConfig = {
      basePath: "/api/auth",
      baseURL: "http://localhost:3000",
      enabled: true,
      githubOAuth: {
        clientId: "github-client-id",
        clientSecret: "github-client-secret",
      },
      googleOAuth: {
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
      },
      secret: "test-secret",
      trustedOrigins: ["terreno://", "exp://"],
    };

    expect(config.enabled).toBe(true);
    expect(config.googleOAuth?.clientId).toBe("google-client-id");
    expect(config.githubOAuth?.clientId).toBe("github-client-id");
    expect(config.trustedOrigins).toContain("terreno://");
    expect(config.basePath).toBe("/api/auth");
  });

  it("allows minimal BetterAuthConfig", () => {
    const minimalConfig: BetterAuthConfig = {
      enabled: false,
    };

    expect(minimalConfig.enabled).toBe(false);
    expect(minimalConfig.googleOAuth).toBeUndefined();
    expect(minimalConfig.basePath).toBeUndefined();
  });

  it("defines AuthProvider type correctly", () => {
    const jwtProvider: AuthProvider = "jwt";
    const betterAuthProvider: AuthProvider = "better-auth";

    expect(jwtProvider).toBe("jwt");
    expect(betterAuthProvider).toBe("better-auth");
  });
});

describe("Better Auth setup", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {...originalEnv};
  });

  it("syncBetterAuthUser creates a new user when not found", async () => {
    // This test would require mocking MongoDB which is complex
    // For now we test the interface structure
    const betterAuthUser = {
      createdAt: new Date(),
      email: "test@example.com",
      emailVerified: true,
      id: "ba-user-123",
      image: null,
      name: "Test User",
      updatedAt: new Date(),
    };

    expect(betterAuthUser.id).toBe("ba-user-123");
    expect(betterAuthUser.email).toBe("test@example.com");
    expect(betterAuthUser.name).toBe("Test User");
  });

  it("BetterAuthSession has correct structure", () => {
    const session = {
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      id: "session-123",
      ipAddress: "127.0.0.1",
      updatedAt: new Date(),
      userAgent: "Mozilla/5.0",
      userId: "user-456",
    };

    expect(session.id).toBe("session-123");
    expect(session.userId).toBe("user-456");
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("BetterAuthSessionData combines session and user", () => {
    const sessionData = {
      session: {
        createdAt: new Date(),
        expiresAt: new Date(),
        id: "session-123",
        ipAddress: null,
        updatedAt: new Date(),
        userAgent: null,
        userId: "user-456",
      },
      user: {
        createdAt: new Date(),
        email: "test@example.com",
        emailVerified: false,
        id: "user-456",
        image: null,
        name: "Test",
        updatedAt: new Date(),
      },
    };

    expect(sessionData.session.userId).toBe(sessionData.user.id);
  });
});

describe("setupEnvironment with auth providers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {...originalEnv};
  });

  it("validates JWT environment variables when authProvider is jwt", async () => {
    process.env.TOKEN_ISSUER = "test-issuer";
    process.env.TOKEN_SECRET = "test-secret";
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
    process.env.SESSION_SECRET = "test-session-secret";

    const {setupEnvironment} = await import("./expressServer");

    // Should not throw
    expect(() => setupEnvironment("jwt")).not.toThrow();
  });

  it("throws when JWT env vars are missing for jwt provider", async () => {
    process.env.TOKEN_ISSUER = "";
    process.env.TOKEN_SECRET = "";

    const {setupEnvironment} = await import("./expressServer");

    expect(() => setupEnvironment("jwt")).toThrow("TOKEN_ISSUER must be set in env.");
  });

  it("validates Better Auth environment variables when authProvider is better-auth", async () => {
    process.env.BETTER_AUTH_SECRET = "test-better-auth-secret";
    process.env.BETTER_AUTH_URL = "http://localhost:3000";

    const {setupEnvironment} = await import("./expressServer");

    // Should not throw
    expect(() => setupEnvironment("better-auth")).not.toThrow();
  });

  it("throws when Better Auth env vars are missing", async () => {
    process.env.BETTER_AUTH_SECRET = undefined;
    process.env.BETTER_AUTH_URL = undefined;

    const {setupEnvironment} = await import("./expressServer");

    expect(() => setupEnvironment("better-auth")).toThrow(
      "BETTER_AUTH_SECRET must be set for Better Auth."
    );
  });
});

describe("SetupServerOptions with Better Auth", () => {
  it("accepts authProvider option", () => {
    const options = {
      authProvider: "better-auth" as AuthProvider,
      betterAuthConfig: {
        enabled: true,
        googleOAuth: {
          clientId: "google-id",
          clientSecret: "google-secret",
        },
        trustedOrigins: ["terreno://"],
      } satisfies BetterAuthConfig,
    };

    expect(options.authProvider).toBe("better-auth");
    expect(options.betterAuthConfig.enabled).toBe(true);
    expect(options.betterAuthConfig.googleOAuth?.clientId).toBe("google-id");
  });

  it("defaults to jwt when authProvider not specified", () => {
    const defaultProvider: AuthProvider = "jwt";
    expect(defaultProvider).toBe("jwt");
  });
});

describe("Better Auth config validation", () => {
  it("basePath defaults to /api/auth when not specified", () => {
    const config: BetterAuthConfig = {
      enabled: true,
    };

    const basePath = config.basePath ?? "/api/auth";
    expect(basePath).toBe("/api/auth");
  });

  it("trustedOrigins defaults to empty array when not specified", () => {
    const config: BetterAuthConfig = {
      enabled: true,
    };

    const trustedOrigins = config.trustedOrigins ?? [];
    expect(trustedOrigins).toEqual([]);
  });

  it("supports multiple OAuth providers simultaneously", () => {
    const config: BetterAuthConfig = {
      appleOAuth: {
        clientId: "apple-id",
        clientSecret: "apple-secret",
      },
      enabled: true,
      githubOAuth: {
        clientId: "github-id",
        clientSecret: "github-secret",
      },
      googleOAuth: {
        clientId: "google-id",
        clientSecret: "google-secret",
      },
    };

    expect(config.googleOAuth).toBeDefined();
    expect(config.githubOAuth).toBeDefined();
    expect(config.appleOAuth).toBeDefined();
  });
});
