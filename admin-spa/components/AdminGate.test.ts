import {describe, expect, it} from "bun:test";
import {isForbiddenAdminConfigError, resolveAdminGateState} from "./adminGateUtils";

describe("isForbiddenAdminConfigError", () => {
  it("returns true only for authenticated 403 responses", () => {
    expect(
      isForbiddenAdminConfigError({
        error: {message: "Forbidden"},
        isAuthenticated: true,
        isConfigLoading: false,
        status: 403,
      })
    ).toBe(true);
  });

  it("returns false for non-403 statuses", () => {
    expect(
      isForbiddenAdminConfigError({
        error: {message: "Server error"},
        isAuthenticated: true,
        isConfigLoading: false,
        status: 500,
      })
    ).toBe(false);
    expect(
      isForbiddenAdminConfigError({
        error: {message: "Rate limited"},
        isAuthenticated: true,
        isConfigLoading: false,
        status: 429,
      })
    ).toBe(false);
  });

  it("returns false when status is unknown", () => {
    expect(
      isForbiddenAdminConfigError({
        error: {message: "Network issue"},
        isAuthenticated: true,
        isConfigLoading: false,
      })
    ).toBe(false);
  });

  it("returns false when unauthenticated, loading, or no error", () => {
    expect(
      isForbiddenAdminConfigError({
        error: {message: "Forbidden"},
        isAuthenticated: false,
        isConfigLoading: false,
        status: 403,
      })
    ).toBe(false);
    expect(
      isForbiddenAdminConfigError({
        error: {message: "Forbidden"},
        isAuthenticated: true,
        isConfigLoading: true,
        status: 403,
      })
    ).toBe(false);
    expect(
      isForbiddenAdminConfigError({
        error: undefined,
        isAuthenticated: true,
        isConfigLoading: false,
        status: 403,
      })
    ).toBe(false);
  });
});

describe("resolveAdminGateState", () => {
  const baseOptions = {
    isAuthenticated: false,
    isAuthLoading: false,
    isForbidden: false,
    isSetupStatusLoading: false,
    needsSetup: false,
  };

  it("returns loading while auth or setup-status is still resolving", () => {
    expect(resolveAdminGateState({...baseOptions, isAuthLoading: true})).toBe("loading");
    expect(resolveAdminGateState({...baseOptions, isSetupStatusLoading: true})).toBe("loading");
  });

  it("returns setup when no admin user exists yet, even for an anonymous visitor", () => {
    expect(resolveAdminGateState({...baseOptions, needsSetup: true})).toBe("setup");
  });

  it("prioritizes setup over login for an authenticated non-admin visitor", () => {
    expect(resolveAdminGateState({...baseOptions, isAuthenticated: true, needsSetup: true})).toBe(
      "setup"
    );
  });

  it("returns login when unauthenticated and setup is not needed", () => {
    expect(resolveAdminGateState({...baseOptions, isAuthenticated: false})).toBe("login");
  });

  it("returns login on a 401 even if isAuthenticated is stale/true", () => {
    expect(resolveAdminGateState({...baseOptions, isAuthenticated: true, status: 401})).toBe(
      "login"
    );
  });

  it("returns forbidden for an authenticated non-admin visitor", () => {
    expect(resolveAdminGateState({...baseOptions, isAuthenticated: true, isForbidden: true})).toBe(
      "forbidden"
    );
  });

  it("returns app for an authenticated admin visitor", () => {
    expect(resolveAdminGateState({...baseOptions, isAuthenticated: true})).toBe("app");
  });
});
