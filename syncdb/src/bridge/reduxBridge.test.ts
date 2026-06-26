import {describe, expect, it} from "bun:test";

import {createSyncDbClient} from "../client";
import {createMemoryPersisterFactory} from "../persisters/memoryPersister";
import {
  createSyncDbBridge,
  SYNCDB_STATUS_CHANGED,
  selectSyncStatus,
  syncDbStatusChanged,
} from "./reduxBridge";

const makeClient = async () => {
  const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
  await client.start();
  return client;
};

describe("reduxBridge", () => {
  it("reducer seeds initial state from the client and applies status actions", async () => {
    const client = await makeClient();
    const bridge = createSyncDbBridge({client});

    const initial = bridge.reducer(undefined, {type: "@@INIT"});
    expect(initial.status.queuedCount).toBe(0);

    const next = bridge.reducer(
      initial,
      syncDbStatusChanged({
        authBlocked: false,
        conflictCount: 0,
        failedCount: 0,
        isOnline: false,
        isSyncing: true,
        queuedCount: 2,
      })
    );
    expect(selectSyncStatus({syncdb: next})).toMatchObject({isOnline: false, queuedCount: 2});
    await client.destroy();
  });

  it("connect dispatches status changes from setters and store mutations", async () => {
    const client = await makeClient();
    const bridge = createSyncDbBridge({client});
    const actions: ReturnType<typeof syncDbStatusChanged>[] = [];
    const disconnect = bridge.connect({dispatch: (action) => actions.push(action)});

    client.setOnline({isOnline: false});
    client.outbox.enqueue({args: {}, collection: "todos", operation: "create"});

    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions.every((a) => a.type === SYNCDB_STATUS_CHANGED)).toBe(true);
    expect(actions[actions.length - 1]?.payload.queuedCount).toBe(1);

    disconnect();
    client.setOnline({isOnline: true});
    const countAfterDisconnect = actions.length;
    client.setOnline({isOnline: false});
    expect(actions.length).toBe(countAfterDisconnect);
    await client.destroy();
  });

  it("exposes mutation dispatchers that write optimistically", async () => {
    const client = await makeClient();
    const bridge = createSyncDbBridge({client});
    const todos = bridge.mutations({collection: "todos"});

    todos.create({data: {title: "via redux bridge"}, id: "t1"});
    expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "via redux bridge",
    });
    expect(client.getSyncStatus().queuedCount).toBe(1);
    await client.destroy();
  });
});
