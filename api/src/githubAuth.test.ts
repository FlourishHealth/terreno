import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {
  type GitHubProfile,
  getGitHubPhotoUrl,
  getGitHubPrimaryEmail,
  isGitHubAuthEnabled,
} from "./githubAuth";

describe("GitHub OAuth helper functions", () => {
  describe("getGitHubPrimaryEmail", () => {
    it("returns primary email when available", () => {
      const profile: GitHubProfile = {
        _json: {},
        _raw: "",
        displayName: "Test User",
        emails: [
          {primary: false, value: "secondary@example.com", verified: true},
          {primary: true, value: "primary@example.com", verified: true},
        ],
        id: "123",
        photos: [],
        username: "testuser",
      };

      expect(getGitHubPrimaryEmail(profile)).toBe("primary@example.com");
    });

    it("returns verified email when no primary is set", () => {
      const profile: GitHubProfile = {
        _json: {},
        _raw: "",
        displayName: "Test User",
        emails: [
          {value: "unverified@example.com", verified: false},
          {value: "verified@example.com", verified: true},
        ],
        id: "123",
        photos: [],
        username: "testuser",
      };

      expect(getGitHubPrimaryEmail(profile)).toBe("verified@example.com");
    });

    it("returns first email when no primary or verified", () => {
      const profile: GitHubProfile = {
        _json: {},
        _raw: "",
        displayName: "Test User",
        emails: [{value: "first@example.com"}, {value: "second@example.com"}],
        id: "123",
        photos: [],
        username: "testuser",
      };

      expect(getGitHubPrimaryEmail(profile)).toBe("first@example.com");
    });

    it("returns null when no emails", () => {
      const profile: GitHubProfile = {
        _json: {},
        _raw: "",
        displayName: "Test User",
        emails: [],
        id: "123",
        photos: [],
        username: "testuser",
      };

      expect(getGitHubPrimaryEmail(profile)).toBeNull();
    });
  });

  describe("getGitHubPhotoUrl", () => {
    it("returns photo URL from photos array", () => {
      const profile: GitHubProfile = {
        _json: {avatar_url: "https://avatars.githubusercontent.com/u/123?v=4"},
        _raw: "",
        displayName: "Test User",
        emails: [],
        id: "123",
        photos: [{value: "https://example.com/photo.jpg"}],
        username: "testuser",
      };

      expect(getGitHubPhotoUrl(profile)).toBe("https://example.com/photo.jpg");
    });

    it("falls back to avatar_url from _json", () => {
      const profile: GitHubProfile = {
        _json: {avatar_url: "https://avatars.githubusercontent.com/u/123?v=4"},
        _raw: "",
        displayName: "Test User",
        emails: [],
        id: "123",
        photos: [],
        username: "testuser",
      };

      expect(getGitHubPhotoUrl(profile)).toBe("https://avatars.githubusercontent.com/u/123?v=4");
    });

    it("returns null when no photo available", () => {
      const profile: GitHubProfile = {
        _json: {},
        _raw: "",
        displayName: "Test User",
        emails: [],
        id: "123",
        photos: [],
        username: "testuser",
      };

      expect(getGitHubPhotoUrl(profile)).toBeNull();
    });
  });

  describe("isGitHubAuthEnabled", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {...originalEnv};
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("returns false when no config provided", () => {
      expect(isGitHubAuthEnabled()).toBe(false);
    });

    it("returns false when only client ID is set", () => {
      process.env.GITHUB_CLIENT_ID = "test-client-id";
      expect(isGitHubAuthEnabled()).toBe(false);
    });

    it("returns false when only client secret is set", () => {
      process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
      expect(isGitHubAuthEnabled()).toBe(false);
    });

    it("returns true when both env vars are set", () => {
      process.env.GITHUB_CLIENT_ID = "test-client-id";
      process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
      expect(isGitHubAuthEnabled()).toBe(true);
    });

    it("returns true when options override env vars", () => {
      expect(
        isGitHubAuthEnabled({
          clientId: "options-client-id",
          clientSecret: "options-client-secret",
        })
      ).toBe(true);
    });

    it("returns true when options partially override env vars", () => {
      process.env.GITHUB_CLIENT_SECRET = "env-client-secret";
      expect(
        isGitHubAuthEnabled({
          clientId: "options-client-id",
        })
      ).toBe(true);
    });
  });
});
