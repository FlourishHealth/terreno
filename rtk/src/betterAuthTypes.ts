/**
 * Better Auth types for use in Redux slices and components.
 *
 * This file contains only type definitions to avoid importing React Native
 * dependencies in environments that don't support them (e.g., tests).
 */

/**
 * Configuration options for the Better Auth client.
 */
export interface BetterAuthClientConfig {
  /**
   * Base URL of the auth server (e.g., "http://localhost:3000").
   */
  baseURL: string;

  /**
   * App URL scheme for deep linking (e.g., "terreno").
   */
  scheme: string;

  /**
   * Storage key prefix for auth tokens.
   * @default "terreno"
   */
  storagePrefix?: string;
}

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

/**
 * OAuth provider types supported by Better Auth.
 */
export type BetterAuthOAuthProvider = "google" | "github" | "apple";

/**
 * Minimal interface for the Better Auth client used by the Redux slice.
 * This interface defines only the methods needed by the slice, allowing
 * tests to use mock clients without importing React Native.
 */
export interface BetterAuthClientInterface {
  getSession: () => Promise<{
    data?: {
      user?: BetterAuthUser;
      session?: BetterAuthSession;
    };
  }>;
  signOut: () => Promise<void>;
}
