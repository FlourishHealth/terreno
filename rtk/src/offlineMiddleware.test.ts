import {describe, expect, it} from "bun:test";

import {isNetworkFetchError} from "./offlineMiddleware";

describe("isNetworkFetchError", () => {
  it("returns true for TypeError error name", () => {
    expect(isNetworkFetchError({error: {name: "TypeError"}})).toBe(true);
  });

  it("returns true for 'failed to fetch' in error.message", () => {
    expect(isNetworkFetchError({error: {message: "Failed to fetch"}})).toBe(true);
  });

  it("returns true for 'fetch failed' in error.message", () => {
    expect(isNetworkFetchError({error: {message: "fetch failed"}})).toBe(true);
  });

  it("returns true for 'network error' in error.message", () => {
    expect(isNetworkFetchError({error: {message: "Network Error"}})).toBe(true);
  });

  it("returns true for 'network unavailable' in error.message", () => {
    expect(isNetworkFetchError({error: {message: "Network unavailable"}})).toBe(true);
  });

  it("returns true for 'load failed' in error.message", () => {
    expect(isNetworkFetchError({error: {message: "Load failed"}})).toBe(true);
  });

  it("returns true for string error field", () => {
    expect(isNetworkFetchError({error: "fetch failed"})).toBe(true);
  });

  it("returns true for payload.error string", () => {
    expect(isNetworkFetchError({payload: {error: "network error"}})).toBe(true);
  });

  it("returns true for FETCH_ERROR status with network error string", () => {
    expect(isNetworkFetchError({error: "Failed to fetch", status: "FETCH_ERROR"})).toBe(true);
  });

  it("returns false for FETCH_ERROR status with non-network error", () => {
    expect(isNetworkFetchError({error: "Unauthorized", status: "FETCH_ERROR"})).toBe(false);
  });

  it("returns false for non-network errors", () => {
    expect(isNetworkFetchError({error: {message: "Unauthorized"}})).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isNetworkFetchError(null)).toBe(false);
    expect(isNetworkFetchError(undefined)).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isNetworkFetchError({})).toBe(false);
  });
});
