import {describe, expect, it} from "bun:test";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";

import {createSyncDb, type SyncDb} from "../client";
import {memoryPersisterFactory} from "../persisters/memoryPersister";
import {OUTBOX_TABLE} from "../storage/types";
import {createFakeTransport, type FakeTransport} from "../testing/fakeTransport";
import type {AuthProvider} from "../types";
import {createCollectionHooks} from "./collectionHooks";
import {SyncDbProvider} from "./provider";

interface TodoData {
  title: string;
  completed?: boolean;
}

let nameCounter = 0;
const uniqueName = (): string => {
  nameCounter += 1;
  return `collection-hooks-test-${nameCounter}`;
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
  await client.reconcile();
  await client.replayOutbox();
  const wrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <SyncDbProvider client={client}>{children}</SyncDbProvider>
  );
  return {client, transport, wrapper};
};

const todoHooks = createCollectionHooks<TodoData, {title: string}, Partial<{title: string}>>({
  collection: "todos",
});

describe("createCollectionHooks", () => {
  it("useListQuery returns list data matching useQuery", async () => {
    const {client, wrapper} = await setup();
    client.mutate({collection: "todos", data: {title: "A"}, operation: "create"});
    const {result} = renderHook(() => todoHooks.useListQuery(), {wrapper});
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0]?.title).toBe("A");
    await act(async () => {
      await client.stop();
    });
  });

  it("useReadQuery returns entity data for an id", async () => {
    const {client, wrapper} = await setup();
    const {id} = client.mutate({collection: "todos", data: {title: "Read me"}, operation: "create"});
    const {result} = renderHook(() => todoHooks.useReadQuery(id), {wrapper});
    expect(result.current.data?.title).toBe("Read me");
    await act(async () => {
      await client.stop();
    });
  });

  it("useCreateMutation returns a one-element trigger tuple", async () => {
    const {client, wrapper} = await setup();
    const {result} = renderHook(() => todoHooks.useCreateMutation(), {wrapper});
    expect(result.current).toHaveLength(1);
    const [createTodo] = result.current;
    const created = createTodo({data: {title: "New"}});
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.mutationId.length).toBeGreaterThan(0);
    await act(async () => {
      await client.stop();
    });
  });

  it("threads retries: false to maxAttempts 1 on the outbox row", async () => {
    const {client, wrapper} = await setup();
    const hooks = createCollectionHooks<TodoData, {title: string}, Partial<{title: string}>>({
      collection: "todos",
      retries: false,
    });
    const {result} = renderHook(() => hooks.useCreateMutation(), {wrapper});
    const [createTodo] = result.current;
    const {mutationId} = createTodo({data: {title: "Fail fast"}});
    const row = client.store.raw.getRow(OUTBOX_TABLE, mutationId) as {maxAttempts?: number};
    expect(row.maxAttempts).toBe(1);
    await act(async () => {
      await client.stop();
    });
  });
});
