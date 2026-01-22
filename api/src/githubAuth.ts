import type express from "express";
import type {Model} from "mongoose";
import passport from "passport";
import {Strategy as GitHubStrategy} from "passport-github2";
import {generateTokens} from "./auth";
import type {AuthOptions} from "./expressServer";
import {logger} from "./logger";

/**
 * Configuration options for GitHub OAuth authentication.
 */
export interface GitHubAuthOptions {
  /**
   * GitHub OAuth App Client ID.
   * Can also be set via GITHUB_CLIENT_ID environment variable.
   */
  clientId?: string;

  /**
   * GitHub OAuth App Client Secret.
   * Can also be set via GITHUB_CLIENT_SECRET environment variable.
   */
  clientSecret?: string;

  /**
   * The callback URL that GitHub will redirect to after authentication.
   * Can also be set via GITHUB_CALLBACK_URL environment variable.
   * Defaults to "/auth/github/callback" if not specified.
   */
  callbackUrl?: string;

  /**
   * OAuth scopes to request from GitHub.
   * Defaults to ["user:email"] if not specified.
   */
  scope?: string[];

  /**
   * URL to redirect to after successful authentication.
   * The token will be appended as a query parameter.
   * Can also be set via GITHUB_SUCCESS_REDIRECT environment variable.
   */
  successRedirect?: string;

  /**
   * URL to redirect to after failed authentication.
   * Can also be set via GITHUB_FAILURE_REDIRECT environment variable.
   */
  failureRedirect?: string;

  /**
   * Custom function to find or create a user from the GitHub profile.
   * If not provided, a default implementation will be used that requires
   * the user model to have findOneOrCreate static method.
   */
  findOrCreateUser?: (profile: GitHubProfile, accessToken: string) => Promise<any>;
}

/**
 * Normalized GitHub profile data passed to findOrCreateUser.
 */
export interface GitHubProfile {
  /**
   * GitHub user ID (numeric string).
   */
  id: string;

  /**
   * GitHub username.
   */
  username: string;

  /**
   * Display name (may be null if not set on GitHub).
   */
  displayName: string | null;

  /**
   * User's email addresses from GitHub.
   * The primary email is the first one marked as primary.
   */
  emails: Array<{value: string; primary?: boolean; verified?: boolean}>;

  /**
   * Profile photo URLs.
   */
  photos: Array<{value: string}>;

  /**
   * Raw profile data from GitHub API.
   */
  _raw: string;

  /**
   * Parsed JSON profile data.
   */
  _json: Record<string, any>;
}

/**
 * User model interface for GitHub OAuth integration.
 * The user model should have these optional fields to store GitHub data.
 */
export interface GitHubUserFields {
  githubId?: string;
  githubUsername?: string;
  githubAccessToken?: string;
}

/**
 * Extended user model interface that includes GitHub-specific methods.
 */
export interface GitHubUserModel extends Model<any> {
  /**
   * Find or create a user based on GitHub profile.
   * This should be implemented by the application.
   */
  findOrCreateFromGitHub?: (profile: GitHubProfile, accessToken: string) => Promise<any>;
}

const getConfig = (options?: GitHubAuthOptions) => {
  const clientId = options?.clientId || process.env.GITHUB_CLIENT_ID;
  const clientSecret = options?.clientSecret || process.env.GITHUB_CLIENT_SECRET;
  const callbackUrl =
    options?.callbackUrl || process.env.GITHUB_CALLBACK_URL || "/auth/github/callback";
  const scope = options?.scope || ["user:email"];
  const successRedirect = options?.successRedirect || process.env.GITHUB_SUCCESS_REDIRECT;
  const failureRedirect =
    options?.failureRedirect || process.env.GITHUB_FAILURE_REDIRECT || "/auth/login";

  return {
    callbackUrl,
    clientId,
    clientSecret,
    failureRedirect,
    scope,
    successRedirect,
  };
};

/**
 * Check if GitHub OAuth is configured and enabled.
 */
export const isGitHubAuthEnabled = (options?: GitHubAuthOptions): boolean => {
  const config = getConfig(options);
  return Boolean(config.clientId && config.clientSecret);
};

/**
 * Sets up the GitHub OAuth passport strategy.
 *
 * This function configures passport to use GitHub OAuth2 authentication.
 * It requires either options to be passed or environment variables to be set.
 *
 * Required environment variables (if not passed in options):
 * - GITHUB_CLIENT_ID: Your GitHub OAuth App client ID
 * - GITHUB_CLIENT_SECRET: Your GitHub OAuth App client secret
 *
 * Optional environment variables:
 * - GITHUB_CALLBACK_URL: OAuth callback URL (defaults to /auth/github/callback)
 * - GITHUB_SUCCESS_REDIRECT: URL to redirect after successful auth
 * - GITHUB_FAILURE_REDIRECT: URL to redirect after failed auth (defaults to /auth/login)
 */
export const setupGitHubAuth = (
  _app: express.Application,
  userModel: GitHubUserModel,
  options?: GitHubAuthOptions
): void => {
  const config = getConfig(options);

  if (!config.clientId || !config.clientSecret) {
    logger.debug(
      "GitHub OAuth not configured - GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set"
    );
    return;
  }

  logger.debug("Setting up GitHub OAuth authentication");

  const findOrCreateUser =
    options?.findOrCreateUser || userModel.findOrCreateFromGitHub?.bind(userModel);

  if (!findOrCreateUser) {
    logger.warn(
      "GitHub OAuth configured but no findOrCreateUser function or findOrCreateFromGitHub static provided"
    );
    return;
  }

  passport.use(
    "github",
    new GitHubStrategy(
      {
        callbackURL: config.callbackUrl,
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        scope: config.scope,
      },
      async (
        accessToken: string,
        _refreshToken: string,
        profile: any,
        done: (error: any, user?: any) => void
      ) => {
        try {
          const githubProfile: GitHubProfile = {
            _json: profile._json || {},
            _raw: profile._raw || "",
            displayName: profile.displayName,
            emails: profile.emails || [],
            id: profile.id,
            photos: profile.photos || [],
            username: profile.username || profile.id,
          };

          const user = await findOrCreateUser(githubProfile, accessToken);

          if (!user) {
            logger.warn("GitHub OAuth: findOrCreateUser returned no user");
            return done(null, false);
          }

          logger.info(`GitHub OAuth: User authenticated: ${user._id}`);
          return done(null, user);
        } catch (error) {
          logger.error(`GitHub OAuth error: ${error}`);
          return done(error);
        }
      }
    )
  );
};

/**
 * Adds GitHub OAuth routes to the Express application.
 *
 * Routes added:
 * - GET /auth/github - Initiates GitHub OAuth flow
 * - GET /auth/github/callback - Handles OAuth callback from GitHub
 *
 * After successful authentication, the user will be redirected to the
 * successRedirect URL with token and refreshToken as query parameters,
 * or receive a JSON response with the tokens if no redirect is configured.
 */
export const addGitHubAuthRoutes = (
  app: express.Application,
  options?: GitHubAuthOptions,
  authOptions?: AuthOptions
): void => {
  const config = getConfig(options);

  if (!config.clientId || !config.clientSecret) {
    return;
  }

  const router = (app as any)._router ? app : app;

  // Route to initiate GitHub OAuth
  router.get(
    "/auth/github",
    passport.authenticate("github", {
      scope: config.scope,
      session: false,
    })
  );

  // OAuth callback route
  router.get(
    "/auth/github/callback",
    passport.authenticate("github", {
      failureRedirect: config.failureRedirect,
      session: false,
    }),
    async (req: any, res: any) => {
      try {
        const user = req.user;
        if (!user) {
          logger.warn("GitHub callback: No user in request");
          return res.redirect(config.failureRedirect);
        }

        const tokens = await generateTokens(user, authOptions);

        if (config.successRedirect) {
          const redirectUrl = new URL(config.successRedirect);
          if (tokens.token) {
            redirectUrl.searchParams.set("token", tokens.token);
          }
          if (tokens.refreshToken) {
            redirectUrl.searchParams.set("refreshToken", tokens.refreshToken);
          }
          redirectUrl.searchParams.set("userId", user._id.toString());
          return res.redirect(redirectUrl.toString());
        }

        return res.json({
          data: {
            refreshToken: tokens.refreshToken,
            token: tokens.token,
            userId: user._id,
          },
        });
      } catch (error) {
        logger.error(`GitHub callback error: ${error}`);
        return res.redirect(config.failureRedirect);
      }
    }
  );

  logger.debug("GitHub OAuth routes added: /auth/github, /auth/github/callback");
};

/**
 * Helper function to extract primary email from GitHub profile.
 */
export const getGitHubPrimaryEmail = (profile: GitHubProfile): string | null => {
  if (!profile.emails || profile.emails.length === 0) {
    return null;
  }

  // Find primary email first
  const primaryEmail = profile.emails.find((e) => e.primary);
  if (primaryEmail) {
    return primaryEmail.value;
  }

  // Fall back to first verified email
  const verifiedEmail = profile.emails.find((e) => e.verified);
  if (verifiedEmail) {
    return verifiedEmail.value;
  }

  // Fall back to first email
  return profile.emails[0]?.value || null;
};

/**
 * Helper function to get profile photo URL from GitHub profile.
 */
export const getGitHubPhotoUrl = (profile: GitHubProfile): string | null => {
  if (!profile.photos || profile.photos.length === 0) {
    return profile._json?.avatar_url || null;
  }
  return profile.photos[0]?.value || null;
};
