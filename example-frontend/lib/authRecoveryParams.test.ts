import {describe, expect, it} from "bun:test";

import {parseAuthTokenFromSearch} from "./authRecoveryParams";

describe("parseAuthTokenFromSearch", () => {
  it("reads token from a query string", () => {
    expect(parseAuthTokenFromSearch("?token=abc123")).toBe("abc123");
  });

  it("reads token without a leading question mark", () => {
    expect(parseAuthTokenFromSearch("token=abc123&other=1")).toBe("abc123");
  });

  it("returns undefined when token is missing or blank", () => {
    expect(parseAuthTokenFromSearch("")).toBeUndefined();
    expect(parseAuthTokenFromSearch("?foo=bar")).toBeUndefined();
    expect(parseAuthTokenFromSearch("?token=")).toBeUndefined();
    expect(parseAuthTokenFromSearch("?token=%20")).toBeUndefined();
  });

  it("decodes a percent-encoded token", () => {
    expect(parseAuthTokenFromSearch("?token=a%2Fb")).toBe("a/b");
  });
});
