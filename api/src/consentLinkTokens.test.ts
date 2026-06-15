import {describe, expect, it} from "bun:test";
import {generateConsentLinkToken, hashConsentLinkToken} from "./consentLinkTokens";

describe("consentLinkTokens", () => {
  it("generates URL-safe tokens", () => {
    const token = generateConsentLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(20);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({length: 100}, () => generateConsentLinkToken()));
    expect(tokens.size).toBe(100);
  });

  it("hashes deterministically", () => {
    const token = "example-token";
    expect(hashConsentLinkToken(token)).toBe(hashConsentLinkToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashConsentLinkToken("a")).not.toBe(hashConsentLinkToken("b"));
  });

  it("produces a 64-character hex sha-256 digest", () => {
    expect(hashConsentLinkToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
