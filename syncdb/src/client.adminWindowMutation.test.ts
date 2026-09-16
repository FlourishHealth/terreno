import {afterEach, describe, expect, it} from "bun:test";

import {createSyncDb} from "./client";
import {createFakeTransport} from "./testing/fakeTransport";

const makeAuthProvider = (userId: string | null = "user-1") => {
  const listeners = new Set<() => void>();
  const state = {userId};
  return {
    provider: {
      getToken: async () => "token",
      getUserId: async () => state.userId,
      onAuthChange: (callback: () => void): (() => void) => {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
    },
  };
};

describe("createSyncDb admin-window mutation mode", () => {
  afterEach(() => {
    // no shared state
  });

  it("tags outbox rows with mutationMode adminWindow for window collections", async () => {
    const transport = createFakeTransport();
    const {provider} = makeAuthProvider();
    const client = createSyncDb({
      authProvider: provider,
      baseUrl: "http://localhost:4000",
      collections: ["todos"],
      name: "admin-window-mutate-test",
      transport,
      windowCollections: ["todos"],
    });
    await client.start();
    const {mutationId} = client.mutate({
      collection: "todos",
      data: {title: "window write"},
      operation: "create",
    });
    expect(client.outbox.getMutation({mutationId})?.mutationMode).toBe("adminWindow");
    await client.stop();
  });

  it("does not tag product collection mutations", async () => {
    const transport = createFakeTransport();
    const {provider} = makeAuthProvider();
    const client = createSyncDb({
      authProvider: provider,
      baseUrl: "http://localhost:4000",
      collections: ["todos", "notes"],
      name: "product-mutate-test",
      transport,
      windowCollections: ["todos"],
    });
    await client.start();
    const {mutationId} = client.mutate({
      collection: "notes",
      data: {title: "product write"},
      operation: "create",
    });
    expect(client.outbox.getMutation({mutationId})?.mutationMode).toBeUndefined();
    await client.stop();
  });
});
