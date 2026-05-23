import {describe, expect, it} from "bun:test";
import {getSentryInitializationDecision} from "./sentryConfig";

describe("getSentryInitializationDecision", () => {
  it("disables Sentry and warns in production without a DSN", () => {
    const decision = getSentryInitializationDecision({
      nodeEnv: "production",
      sentryDsn: undefined,
    });

    expect(decision).toEqual({
      shouldInitialize: false,
      shouldWarnMissingDsn: true,
    });
  });

  it("enables Sentry when a DSN is present", () => {
    const decision = getSentryInitializationDecision({
      nodeEnv: "production",
      sentryDsn: "https://dsn.example/123",
    });

    expect(decision).toEqual({
      shouldInitialize: true,
      shouldWarnMissingDsn: false,
    });
  });

  it("does not warn in non-production when DSN is missing", () => {
    const decision = getSentryInitializationDecision({
      nodeEnv: "development",
      sentryDsn: undefined,
    });

    expect(decision).toEqual({
      shouldInitialize: false,
      shouldWarnMissingDsn: false,
    });
  });
});
