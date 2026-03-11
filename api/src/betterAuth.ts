/**
 * Better Auth types and configuration interfaces for @terreno/api.
 *
 * These types support optional Better Auth integration alongside the existing
 * JWT/Passport authentication system.
 */

/**
 * OAuth provider configuration for Better Auth.
 */
export interface BetterAuthOAuthProvider {
  clientId: string;
  clientSecret: string;
}

/**
 * Configuration options for Better Auth integration.
 */
export interface BetterAuthConfig {
  /**
   * Whether Better Auth is enabled for this server.
   */
  enabled: boolean;

  /**
   * Google OAuth provider configuration.
   */
  googleOAuth?: BetterAuthOAuthProvider;

  /**
   * Apple OAuth provider configuration.
   */
  appleOAuth?: BetterAuthOAuthProvider;

  /**
   * GitHub OAuth provider configuration.
   */
  githubOAuth?: BetterAuthOAuthProvider;

  /**
   * Trusted origins for CORS and redirect validation.
   * Include your app's deep link schemes (e.g., "terreno://", "exp://").
   */
  trustedOrigins?: string[];

  /**
   * Base path for Better Auth routes.
   * @default "/api/auth"
   */
  basePath?: string;

  /**
   * Secret key for Better Auth session encryption.
   * If not provided, falls back to BETTER_AUTH_SECRET environment variable.
   */
  secret?: string;

  /**
   * Base URL for the auth server.
   * If not provided, falls back to BETTER_AUTH_URL environment variable.
   */
  baseURL?: string;
}

/**
 * Auth provider selection for setupServer.
 * - "jwt": Traditional JWT/Passport authentication (default)
 * - "better-auth": Better Auth with OAuth support
 */
export type AuthProvider = "jwt" | "better-auth";

/**
 * User data from Better Auth session.
 */
export interface BetterAuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session data from Better Auth.
 */
export interface BetterAuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Combined session and user data from Better Auth.
 */
export interface BetterAuthSessionData {
  session: BetterAuthSession;
  user: BetterAuthUser;
}
