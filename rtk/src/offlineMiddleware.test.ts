import {describe, expect, it} from "bun:test";

import {
  buildOptimisticCreateItem,
  isNetworkFetchError,
  shouldReplayQueuedMutation,
} from "./offlineMiddleware";
import type {QueuedMutation} from "./offlineSlice";

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

describe("shouldReplayQueuedMutation", () => {
  const baseMutation: QueuedMutation = {
    args: {body: {title: "Test"}},
    endpointName: "postTodos",
    id: "m1",
    timestamp: "2026-04-15T10:00:00.000Z",
    type: "create",
    userId: "user-a",
  };

  it("replays when userId matches current user", () => {
    expect(shouldReplayQueuedMutation(baseMutation, "user-a")).toBe(true);
  });

  it("does not replay when userId differs from current user", () => {
    expect(shouldReplayQueuedMutation(baseMutation, "user-b")).toBe(false);
  });

  it("does not replay legacy mutations without userId", () => {
    const legacy = {...baseMutation, userId: undefined};
    expect(shouldReplayQueuedMutation(legacy, "user-a")).toBe(false);
  });

  it("does not replay when current user is missing", () => {
    expect(shouldReplayQueuedMutation(baseMutation, undefined)).toBe(false);
  });
});

describe("buildOptimisticCreateItem", () => {
  const mutation: QueuedMutation = {
    args: {body: {title: "New"}},
    endpointName: "postTodos",
    id: "queue-1",
    timestamp: "2026-04-15T10:00:00.000Z",
    type: "create",
  };

  it("applies temp ids after body spread so client ids cannot win", () => {
    const item = buildOptimisticCreateItem(mutation, {
      _id: "client-id",
      id: "client-id",
      title: "New",
    });

    expect(item._id).toBe("temp-queue-1");
    expect(item.id).toBe("temp-queue-1");
    expect(item.title).toBe("New");
    expect(item.created).toBe(mutation.timestamp);
    expect(item.updated).toBe(mutation.timestamp);
  });
});
