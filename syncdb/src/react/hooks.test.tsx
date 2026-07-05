import {describe, expect, it} from "bun:test";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";

import {createSyncDb, type SyncDb} from "../client";
import {memoryPersisterFactory} from "../persisters/memoryPersister";
import {createFakeTransport, type FakeTransport} from "../sync/fakeTransport";
import type {AuthProvider, SyncDelta} from "../types";
import {useConflicts, useEntity, useMutate, useQuery, useSyncStatus} from "./hooks";
import {SyncDbProvider, useSyncDbClient} from "./provider";

interface TodoData {
  title: string;
  completed?: boolean;
}

let nameCounter = 0;
const uniqueName = (): string => {
  nameCounter += 1;
  return `react-hooks-test-${nameCounter}`;
};

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
};

const makeAuthProvider = (userId: string): AuthProvider => ({
  getToken: async () => "token",
  getUserId: async () => userId,
  onAuthChange: () => () => {},
});

interface Harness {
  client: SyncDb;
  transport: FakeTransport;
  wrapper: React.FC<{children: React.ReactNode}>;
}

const setup = async (): Promise<Harness> => {
  const transport = createFakeTransport();
  const client = createSyncDb({
    authProvider: makeAuthProvider("u1"),
    collections: ["todos"],
    name: uniqueName(),
    persisterFactory: memoryPersisterFactory,
    reconcileIntervalMs: 0,
    transport,
  });
  await client.start();
  const wrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <SyncDbProvider client={client}>{children}</SyncDbProvider>
  );
  return {client, transport, wrapper};
};

const makeDelta = (overrides: Partial<SyncDelta> = {}): SyncDelta => ({
  collection: "todos",
  data: {title: "from server"},
  id: "t1",
  method: "create",
  seq: 1,
  stream: "todos|owner:u1",
  ...overrides,
});

describe("SyncDbProvider / useSyncDbClient", () => {
  it("throws a descriptive error outside the provider", () => {
    expect(() => renderHook(() => useSyncDbClient())).toThrow(
      "useSyncDbClient must be used within a <SyncDbProvider"
    );
  });

  it("returns the client inside the provider", async () => {
    const {client, wrapper} = await setup();
    const {result} = renderHook(() => useSyncDbClient(), {wrapper});
    expect(result.current).toBe(client);
    await act(async () => {
      await client.stop();
    });
  });
});

describe("useEntity", () => {
  it("returns an empty snapshot for a missing entity", async () => {
    const {client, wrapper} = await setup();
    const {result} = renderHook(() => useEntity<TodoData>("todos", "missing"), {wrapper});
    expect(result.current).toEqual({data: undefined, deleted: false, isPending: false, seq: 0});
    await act(async () => {
      await client.stop();
    });
  });

  it("re-renders on a local write and reports the pending flag", async () => {
    const {client, transport, wrapper} = await setup();
    // Keep the mutation un-acked so the optimistic pending flag is observable.
    transport.setDefaultResponder(() => {
      throw new Error("offline");
    });
    const {result} = renderHook(() => useEntity<TodoData>("todos", "t1"), {wrapper});
    expect(result.current.data).toBeUndefined();

    act(() => {
      client.mutate({collection: "todos", data: {title: "Local"}, id: "t1", operation: "create"});
    });

    expect(result.current.data?.title).toBe("Local");
    expect(result.current.isPending).toBe(true);
    expect(result.current.deleted).toBe(false);
    await act(async () => {
      await client.stop();
    });
  });

  it("re-renders when a server delta is applied, including tombstones", async () => {
    const {client, transport, wrapper} = await setup();
    const {result} = renderHook(() => useEntity<TodoData>("todos", "t1"), {wrapper});

    act(() => {
      transport.deliverDelta(makeDelta({data: {title: "from server"}, seq: 1}));
    });
    expect(result.current.data?.title).toBe("from server");
    expect(result.current.seq).toBe(1);
    expect(result.current.isPending).toBe(false);

    act(() => {
      transport.deliverDelta(makeDelta({deleted: true, method: "delete", seq: 2}));
    });
    expect(result.current.deleted).toBe(true);
    await act(async () => {
      await client.stop();
    });
  });
});

describe("useQuery", () => {
  it("re-renders on table changes and excludes tombstones by default", async () => {
    const {client, transport, wrapper} = await setup();
    const {result} = renderHook(() => useQuery<TodoData>("todos"), {wrapper});
    expect(result.current).toEqual([]);

    act(() => {
      transport.deliverDelta(makeDelta({data: {title: "one"}, id: "t1", seq: 1}));
      transport.deliverDelta(makeDelta({data: {title: "two"}, id: "t2", seq: 2}));
    });
    expect(result.current.map((todo) => todo.title).sort()).toEqual(["one", "two"]);

    act(() => {
      client.store.softDeleteEntity({collection: "todos", id: "t1"});
    });
    expect(result.current.map((todo) => todo.title)).toEqual(["two"]);
    await act(async () => {
      await client.stop();
    });
  });

  it("includes tombstones when includeDeleted is set", async () => {
    const {client, wrapper} = await setup();
    act(() => {
      client.store.upsertEntity({collection: "todos", data: {title: "gone"}, id: "t1"});
      client.store.softDeleteEntity({collection: "todos", id: "t1"});
    });
    const {result} = renderHook(() => useQuery<TodoData>("todos", {includeDeleted: true}), {
      wrapper,
    });
    expect(result.current).toHaveLength(1);
    await act(async () => {
      await client.stop();
    });
  });

  it("applies filter and sort in JS", async () => {
    const {client, wrapper} = await setup();
    act(() => {
      client.store.upsertEntity({
        collection: "todos",
        data: {completed: true, title: "b done"},
        id: "t1",
      });
      client.store.upsertEntity({
        collection: "todos",
        data: {completed: false, title: "c open"},
        id: "t2",
      });
      client.store.upsertEntity({
        collection: "todos",
        data: {completed: true, title: "a done"},
        id: "t3",
      });
    });
    const {result} = renderHook(
      () =>
        useQuery<TodoData>("todos", {
          filter: (todo) => todo.completed === true,
          sort: (a, b) => a.title.localeCompare(b.title),
        }),
      {wrapper}
    );
    expect(result.current.map((todo) => todo.title)).toEqual(["a done", "b done"]);
    await act(async () => {
      await client.stop();
    });
  });

  it("keeps a stable array identity across unrelated re-renders", async () => {
    const {client, wrapper} = await setup();
    act(() => {
      client.store.upsertEntity({collection: "todos", data: {title: "same"}, id: "t1"});
    });
    const {rerender, result} = renderHook(() => useQuery<TodoData>("todos"), {wrapper});
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
    await act(async () => {
      await client.stop();
    });
  });
});

describe("useMutate", () => {
  it("create applies optimistically and enqueues an outbox mutation", async () => {
    const {client, transport, wrapper} = await setup();
    transport.setDefaultResponder(() => {
      throw new Error("offline");
    });
    const {result} = renderHook(
      () => ({mutate: useMutate("todos"), todos: useQuery<TodoData>("todos")}),
      {wrapper}
    );

    let created: {mutationId: string; id: string} | undefined;
    act(() => {
      created = result.current.mutate.create({data: {title: "Offline task"}});
    });
    expect(created?.id).toBeTruthy();
    expect(result.current.todos.map((todo) => todo.title)).toEqual(["Offline task"]);

    // The failed send requeues the mutation; it stays durably queued.
    await act(flush);
    expect(client.outbox.listQueued({userId: "u1"})).toHaveLength(1);
    await act(async () => {
      await client.stop();
    });
  });

  it("update merges fields and remove tombstones the entity", async () => {
    const {client, transport, wrapper} = await setup();
    transport.setDefaultResponder(() => {
      throw new Error("offline");
    });
    act(() => {
      client.store.upsertEntity({
        collection: "todos",
        data: {completed: false, title: "keep me"},
        id: "t1",
      });
    });
    const {result} = renderHook(
      () => ({entity: useEntity<TodoData>("todos", "t1"), mutate: useMutate("todos")}),
      {wrapper}
    );

    act(() => {
      result.current.mutate.update({data: {completed: true}, id: "t1"});
    });
    expect(result.current.entity.data).toEqual({completed: true, title: "keep me"});

    act(() => {
      result.current.mutate.remove({id: "t1"});
    });
    expect(result.current.entity.deleted).toBe(true);

    await act(flush);
    const operations = client.outbox.listQueued({userId: "u1"}).map((m) => m.operation);
    expect(operations).toEqual(["update", "delete"]);
    await act(async () => {
      await client.stop();
    });
  });
});

describe("useSyncStatus", () => {
  it("reflects queued counts and connectivity reactively", async () => {
    const {client, transport, wrapper} = await setup();
    transport.setDefaultResponder(() => {
      throw new Error("offline");
    });
    const {result} = renderHook(() => useSyncStatus(), {wrapper});
    expect(result.current.isOnline).toBe(true);
    expect(result.current.queuedCount).toBe(0);

    await act(async () => {
      client.mutate({collection: "todos", data: {title: "queued"}, operation: "create"});
      await flush();
    });
    expect(result.current.queuedCount).toBe(1);

    act(() => {
      transport.setConnected(false);
    });
    expect(result.current.isOnline).toBe(false);
    await act(async () => {
      await client.stop();
    });
  });

  it("reflects conflict counts and stream cursors reactively", async () => {
    const {client, transport, wrapper} = await setup();
    const {result} = renderHook(() => useSyncStatus(), {wrapper});
    expect(result.current.conflictCount).toBe(0);
    expect(result.current.streams).toEqual({});

    act(() => {
      transport.deliverDelta(makeDelta({seq: 1}));
    });
    expect(result.current.streams).toEqual({"todos|owner:u1": 1});

    act(() => {
      client.store.upsertEntity({collection: "todos", data: {title: "mine"}, id: "t9"});
    });
    transport.respondWithNack({code: "conflict", serverDoc: {title: "server"}, serverSeq: 7});
    await act(async () => {
      client.mutate({collection: "todos", data: {title: "mine v2"}, id: "t9", operation: "update"});
      await flush();
    });
    expect(result.current.conflictCount).toBe(1);
    await act(async () => {
      await client.stop();
    });
  });
});

describe("useConflicts", () => {
  const recordConflict = async (harness: Harness): Promise<string> => {
    const {client, transport} = harness;
    act(() => {
      client.store.upsertEntity({collection: "todos", data: {title: "mine"}, id: "t1"});
    });
    transport.respondWithNack({code: "conflict", serverDoc: {title: "server"}, serverSeq: 7});
    let mutationId = "";
    await act(async () => {
      mutationId = client.mutate({
        collection: "todos",
        data: {title: "mine v2"},
        id: "t1",
        operation: "update",
      }).mutationId;
      await flush();
    });
    return mutationId;
  };

  it("lists conflicts reactively and resolve clears them", async () => {
    const harness = await setup();
    const {client, wrapper} = harness;
    const {result} = renderHook(
      () => ({conflicts: useConflicts(), entity: useEntity<TodoData>("todos", "t1")}),
      {wrapper}
    );
    expect(result.current.conflicts.conflicts).toEqual([]);

    const mutationId = await recordConflict(harness);
    expect(result.current.conflicts.conflicts).toHaveLength(1);
    expect(result.current.conflicts.conflicts[0]?.mutationId).toBe(mutationId);
    expect(result.current.conflicts.conflicts[0]?.serverSeq).toBe(7);

    act(() => {
      result.current.conflicts.resolve({mutationId, strategy: "useServer"});
    });
    expect(result.current.conflicts.conflicts).toEqual([]);
    expect(result.current.entity.data?.title).toBe("server");
    expect(result.current.entity.seq).toBe(7);
    await act(async () => {
      await client.stop();
    });
  });

  it("keepMine requeues the mutation and keeps the optimistic data", async () => {
    const harness = await setup();
    const {client, transport, wrapper} = harness;
    const {result} = renderHook(
      () => ({conflicts: useConflicts(), entity: useEntity<TodoData>("todos", "t1")}),
      {wrapper}
    );
    const mutationId = await recordConflict(harness);

    // Keep the requeued retry pending so the requeue itself is observable.
    transport.setDefaultResponder(() => {
      throw new Error("offline");
    });
    act(() => {
      result.current.conflicts.resolve({mutationId, strategy: "keepMine"});
    });
    expect(result.current.conflicts.conflicts).toEqual([]);
    expect(result.current.entity.data?.title).toBe("mine v2");
    expect(client.outbox.getMutation({mutationId})?.status).toBe("queued");
    expect(client.outbox.getMutation({mutationId})?.baseVersion).toBe(7);
    await act(async () => {
      await client.stop();
    });
  });
});
