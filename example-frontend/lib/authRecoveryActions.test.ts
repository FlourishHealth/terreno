import {describe, expect, it} from "bun:test";

import {
  submitEmailVerification,
  submitPasswordReset,
  submitPasswordResetRequest,
} from "./authRecoveryActions";

describe("submitPasswordResetRequest", () => {
  it("requires a trimmed email", async () => {
    const result = await submitPasswordResetRequest({
      email: "  ",
      requestJwtPasswordReset: async () => {
        throw new Error("should not call jwt");
      },
      requestPasswordReset: async () => {
        throw new Error("should not call better auth");
      },
    });
    expect(result).toEqual({
      errorMessage: "Enter the email for your account.",
      submitted: false,
    });
  });

  it("returns submitted after Better Auth succeeds", async () => {
    const emails: string[] = [];
    const result = await submitPasswordResetRequest({
      email: " person@example.com ",
      requestJwtPasswordReset: async () => {
        throw new Error("should not call jwt");
      },
      requestPasswordReset: async (email) => {
        emails.push(email);
        return {};
      },
    });
    expect(emails).toEqual(["person@example.com"]);
    expect(result).toEqual({submitted: true});
  });

  it("falls back to JWT when Better Auth returns an error", async () => {
    const jwtEmails: string[] = [];
    const result = await submitPasswordResetRequest({
      email: "person@example.com",
      requestJwtPasswordReset: async (email) => {
        jwtEmails.push(email);
      },
      requestPasswordReset: async () => ({error: {message: "unavailable"}}),
    });
    expect(jwtEmails).toEqual(["person@example.com"]);
    expect(result).toEqual({submitted: true});
  });

  it("returns a retry message when both paths throw", async () => {
    const result = await submitPasswordResetRequest({
      email: "person@example.com",
      requestJwtPasswordReset: async () => {},
      requestPasswordReset: async () => {
        throw new Error("network");
      },
    });
    expect(result).toEqual({
      errorMessage: "Could not send a reset email. Please try again.",
      submitted: false,
    });
  });
});

describe("submitPasswordReset", () => {
  it("rejects a missing token", async () => {
    const result = await submitPasswordReset({
      password: "NewPassword123",
      resetJwtPassword: async () => {
        throw new Error("should not call jwt");
      },
      resetPasswordWithToken: async () => {
        throw new Error("should not call better auth");
      },
      token: undefined,
    });
    expect(result.submitted).toBe(false);
    expect(result.errorMessage).toContain("missing a token");
  });

  it("rejects a short password", async () => {
    const result = await submitPasswordReset({
      password: "short",
      resetJwtPassword: async () => {
        throw new Error("should not call jwt");
      },
      resetPasswordWithToken: async () => {
        throw new Error("should not call better auth");
      },
      token: "reset-token",
    });
    expect(result).toEqual({
      errorMessage: "Password must be at least 6 characters.",
      submitted: false,
    });
  });

  it("returns submitted after Better Auth succeeds", async () => {
    const result = await submitPasswordReset({
      password: "NewPassword123",
      resetJwtPassword: async () => {
        throw new Error("should not call jwt");
      },
      resetPasswordWithToken: async () => ({}),
      token: "reset-token",
    });
    expect(result).toEqual({submitted: true});
  });

  it("falls back to JWT when Better Auth returns an error", async () => {
    const jwtCalls: Array<{password: string; token: string}> = [];
    const result = await submitPasswordReset({
      password: "NewPassword123",
      resetJwtPassword: async (args) => {
        jwtCalls.push(args);
      },
      resetPasswordWithToken: async () => ({error: {message: "nope"}}),
      token: "reset-token",
    });
    expect(jwtCalls).toEqual([{password: "NewPassword123", token: "reset-token"}]);
    expect(result).toEqual({submitted: true});
  });

  it("returns an invalid-link message when reset throws", async () => {
    const result = await submitPasswordReset({
      password: "NewPassword123",
      resetJwtPassword: async () => {},
      resetPasswordWithToken: async () => {
        throw new Error("expired");
      },
      token: "reset-token",
    });
    expect(result.submitted).toBe(false);
    expect(result.errorMessage).toContain("invalid or expired");
  });
});

describe("submitEmailVerification", () => {
  it("rejects a missing token", async () => {
    const result = await submitEmailVerification({
      token: undefined,
      verifyEmailWithToken: async () => {
        throw new Error("should not call better auth");
      },
      verifyJwtEmail: async () => {
        throw new Error("should not call jwt");
      },
    });
    expect(result.submitted).toBe(false);
    expect(result.errorMessage).toContain("missing a token");
  });

  it("returns submitted after Better Auth succeeds", async () => {
    const result = await submitEmailVerification({
      token: "verify-token",
      verifyEmailWithToken: async () => ({}),
      verifyJwtEmail: async () => {
        throw new Error("should not call jwt");
      },
    });
    expect(result).toEqual({submitted: true});
  });

  it("falls back to JWT when Better Auth returns an error", async () => {
    const jwtTokens: string[] = [];
    const result = await submitEmailVerification({
      token: "verify-token",
      verifyEmailWithToken: async () => ({error: {message: "nope"}}),
      verifyJwtEmail: async (token) => {
        jwtTokens.push(token);
      },
    });
    expect(jwtTokens).toEqual(["verify-token"]);
    expect(result).toEqual({submitted: true});
  });

  it("returns an invalid-link message when verify throws", async () => {
    const result = await submitEmailVerification({
      token: "verify-token",
      verifyEmailWithToken: async () => {
        throw new Error("expired");
      },
      verifyJwtEmail: async () => {},
    });
    expect(result.submitted).toBe(false);
    expect(result.errorMessage).toContain("invalid or expired");
  });
});
