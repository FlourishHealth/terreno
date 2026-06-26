import {describe, expect, it} from "bun:test";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";

import {createSyncDbClient, type SyncDbClient} from "../client";
import {createMemoryPersisterFactory} from "../persisters/memoryPersister";
import {useConflicts, useEntity, useQuery, useSyncMutations, useSyncStatus} from "./hooks";
import {SyncDbProvider, useSyncDbClient} from "./provider";

interface TodoData {
  title: string;
}

const setup = async (): Promise<{
  client: SyncDbClient;
  wrapper: React.FC<{children: React.ReactNode}>;
}> => {
  const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
  await client.start();
  const wrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <SyncDbProvider client={client}>{children}</SyncDbProvider>
  );
  return {client, wrapper};
};

describe("react hooks", () => {
  it("useSyncDbClient throws without a provider", () => {
    expect(() => renderHook(() => useSyncDbClient())).toThrow();
  });

  it("useQuery + useSyncMutations create reflects optimistically and queues", async () => {
    const {wrapper} = await setup();
    const {result} = renderHook(
      () => ({
        mutations: useSyncMutations<TodoData>({collection: "todos"}),
        status: useSyncStatus(),
        todos: useQuery<TodoData>({collection: "todos"}),
      }),
      {wrapper}
    );

    expect(result.current.todos).toHaveLength(0);

    act(() => {
      result.current.mutations.create({data: {title: "Offline task"}, id: "t1"});
    });

    expect(result.current.todos).toHaveLength(1);
    expect(result.current.todos[0].data.title).toBe("Offline task");
    expect(result.current.status.queuedCount).toBe(1);
  });

  it("useEntity re-renders when its entity changes", async () => {
    const {client, wrapper} = await setup();
    const {result} = renderHook(() => useEntity<TodoData>({collection: "todos", id: "t1"}), {
      wrapper,
    });

    expect(result.current).toBeUndefined();

    act(() => {
      client.store.upsertEntity({collection: "todos", data: {title: "Hello"}, id: "t1"});
    });

    expect(result.current?.data.title).toBe("Hello");
  });

  it("useConflicts lists conflicts and resolves them", async () => {
    const {client, wrapper} = await setup();
    const {result} = renderHook(() => useConflicts<TodoData>(), {wrapper});

    act(() => {
      client.store.upsertEntity({collection: "todos", data: {title: "Mine"}, id: "t1"});
      client.conflicts.capture({
        collection: "todos",
        conflictId: "c1",
        entityId: "t1",
        localData: {title: "Mine"},
        mutationId: "m1",
        serverData: {title: "Server"},
      });
    });

    expect(result.current.conflicts).toHaveLength(1);

    act(() => {
      result.current.resolve({conflictId: "c1", strategy: "useServer"});
    });

    expect(result.current.conflicts).toHaveLength(0);
    expect(client.store.getEntity<TodoData>({collection: "todos", id: "t1"})?.data.title).toBe(
      "Server"
    );
  });
});
