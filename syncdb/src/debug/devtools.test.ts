import {afterEach, describe, it} from "bun:test";
import {assert} from "chai";

import {createSyncDb} from "../client";
import {createFakeTransport} from "../testing/fakeTransport";

interface TestDevtoolsClient {
  inspect: () => {
    collections: Record<string, {entities: Array<{data: unknown; id: string; seq: number}>}>;
    debug?: unknown;
  };
  snapshot: () => {mergeableContent: unknown};
  setLocalEntity: (args: Record<string, unknown>) => void;
  deleteLocalEntity: (args: Record<string, unknown>) => void;
  merge: (content: unknown) => void;
  mutate: (args: Record<string, unknown>) => unknown;
  flush: () => Promise<void>;
}

interface TestDevtoolsRegistry {
  clients: Record<string, TestDevtoolsClient>;
  list: () => string[];
}

const getRegistry = (): TestDevtoolsRegistry | undefined => {
  return (
    globalThis as typeof globalThis & {
      __TERRENO_SYNCDB__?: TestDevtoolsRegistry;
    }
  ).__TERRENO_SYNCDB__;
};

afterEach((): void => {
  Reflect.deleteProperty(globalThis, "__TERRENO_SYNCDB__");
});

describe("SyncDB devtools registry", () => {
  it("registers debug clients with debugger state and mutation controls", async (): Promise<void> => {
    const client = createSyncDb({
      authProvider: {
        getToken: async (): Promise<string | null> => "token",
        getUserId: async (): Promise<string | null> => "user-1",
        onAuthChange:
          (_callback: () => void): (() => void) =>
          (): void => {},
      },
      collections: ["todos"],
      debug: true,
      name: "devtools-test",
      reconcileIntervalMs: 0,
      transport: createFakeTransport(),
    });
    await client.start();

    const registry = getRegistry();
    assert.include(registry?.list() ?? [], "devtools-test");
    const bridge = registry?.clients["devtools-test"];
    assert.exists(bridge);

    bridge.setLocalEntity({
      collection: "todos",
      data: {password: "visible-to-MCP-redactor", title: "Local"},
      id: "todo-1",
      seq: 4,
      stream: "todos|owner:user-1",
    });
    const state = bridge.inspect();
    assert.equal(state?.collections.todos?.entities[0]?.id, "todo-1");
    assert.equal(state?.collections.todos?.entities[0]?.seq, 4);
    assert.exists(state?.debug);

    const snapshot = bridge.snapshot();
    bridge.deleteLocalEntity({collection: "todos", id: "todo-1"});
    assert.lengthOf(bridge.inspect().collections.todos?.entities ?? [], 0);
    bridge.merge(snapshot.mergeableContent);
    assert.equal(bridge.inspect().collections.todos?.entities[0]?.id, "todo-1");

    bridge.mutate({
      collection: "todos",
      data: {title: "Updated"},
      id: "todo-1",
      operation: "update",
    });
    await bridge.flush();
    assert.equal(
      (bridge.inspect().collections.todos?.entities[0]?.data as {title?: string})?.title,
      "Updated"
    );
    await client.stop();
  });

  it("does not register clients when debugging is disabled", (): void => {
    createSyncDb({
      authProvider: {
        getToken: async (): Promise<string | null> => "token",
        getUserId: async (): Promise<string | null> => "user-1",
        onAuthChange:
          (_callback: () => void): (() => void) =>
          (): void => {},
      },
      collections: ["todos"],
      name: "production-client",
      transport: createFakeTransport(),
    });

    assert.isUndefined(getRegistry());
  });
});
