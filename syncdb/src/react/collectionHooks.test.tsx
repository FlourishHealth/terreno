import {describe, expect, it} from "bun:test";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";

import {createSyncDb, type SyncDb} from "../client";
import {retriesToMaxAttempts} from "../maxAttempts";
import {memoryPersisterFactory} from "../persisters/memoryPersister";
import {createFakeTransport} from "../testing/fakeTransport";
import type {AuthProvider} from "../types";
import {createCollectionHooks} from "./collectionHooks";
import {SyncDbProvider} from "./provider";

interface TodoData {
  title: string;
  completed?: boolean;
}

interface CreateTodo {
  title: string;
  completed?: boolean;
}

let nameCounter = 0;
const uniqueName = (): string => {
  nameCounter += 1;
  return `collection-hooks-test-${nameCounter}`;
};

const makeAuthProvider = (userId: string): AuthProvider => {
  const listeners = new Set<() => void>();
  return {
    getToken: async () => "token",
    getUserId: async () => userId,
    onAuthChange: (callback: () => void): (() => void) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
};

const setup = async (): Promise<{
  client: SyncDb;
  wrapper: React.FC<{children: React.ReactNode}>;
}> => {
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
  return {client, wrapper};
};

describe("retriesToMaxAttempts", () => {
  it("maps false to a single attempt", () => {
    expect(retriesToMaxAttempts(false)).toBe(1);
  });

  it("maps a number through", () => {
    expect(retriesToMaxAttempts(3)).toBe(3);
  });

  it("omits the engine default when retries is undefined or true", () => {
    expect(retriesToMaxAttempts(undefined)).toBeUndefined();
    expect(retriesToMaxAttempts(true)).toBeUndefined();
  });
});

describe("createCollectionHooks", () => {
  it("list/read/create/update/delete match direct hook behavior", async () => {
    const {client, wrapper} = await setup();
    const hooks = createCollectionHooks<TodoData, CreateTodo, Partial<CreateTodo>>({
      collection: "todos",
    });

    const {result, unmount} = renderHook(
      () => {
        const list = hooks.useListQuery();
        const [create] = hooks.useCreateMutation();
        const [update] = hooks.useUpdateMutation();
        const [remove] = hooks.useDeleteMutation();
        return {create, list, remove, update};
      },
      {wrapper}
    );

    let createdId = "";
    act(() => {
      createdId = result.current.create({data: {title: "from factory"}}).id;
    });
    expect(result.current.list.data).toEqual([{title: "from factory"}]);

    const {result: readResult} = renderHook(() => hooks.useReadQuery(createdId), {wrapper});
    expect(readResult.current.data?.title).toBe("from factory");
    expect(readResult.current.isPending).toBe(true);

    act(() => {
      result.current.update({data: {completed: true}, id: createdId});
    });
    expect(readResult.current.data?.completed).toBe(true);

    act(() => {
      result.current.remove({id: createdId});
    });
    expect(result.current.list.data).toEqual([]);

    unmount();
    await act(async () => {
      await client.stop();
    });
  });

  it("threads retries: false onto the outbox row as maxAttempts: 1", async () => {
    const {client, wrapper} = await setup();
    const hooks = createCollectionHooks<TodoData, CreateTodo>({
      collection: "todos",
      retries: false,
    });
    const {result, unmount} = renderHook(() => hooks.useCreateMutation(), {wrapper});
    const [create] = result.current;
    let mutationId = "";
    act(() => {
      mutationId = create({data: {title: "once"}}).mutationId;
    });
    expect(client.outbox.getMutation({mutationId})?.maxAttempts).toBe(1);
    unmount();
    await act(async () => {
      await client.stop();
    });
  });
});
