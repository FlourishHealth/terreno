import {describe, expect, it} from "bun:test";
import type {Api} from "@reduxjs/toolkit/query/react";

import {
  applyOptimisticUpdate,
  patchCacheWithServerDocument,
  removeOptimisticTempItems,
} from "./offlineOptimistic";
import {createTestQueuedMutation} from "./offlineTestUtils";

interface CacheEntry {
  draft: {data: Record<string, unknown>[]};
  queryArg: unknown;
}

interface CacheHarness {
  // biome-ignore lint/suspicious/noExplicitAny: Test double covers only RTK Query util methods used here.
  api: Api<any, any, any, any>;
  dispatch: (action: unknown) => void;
  entries: CacheEntry[];
  getState: () => unknown;
}

const filteredQueryArg = {completed: false};

const createCacheHarness = (): CacheHarness => {
  const entries: CacheEntry[] = [
    {
      draft: {data: [{_id: "todo-1", title: "Original"}]},
      queryArg: undefined,
    },
    {
      draft: {data: [{_id: "todo-1", title: "Original filtered"}]},
      queryArg: filteredQueryArg,
    },
  ];
  const dispatched: unknown[] = [];
  const api = {
    reducerPath: "testApi",
    util: {
      invalidateTags: () => ({type: "testApi/invalidateTags"}),
      updateQueryData: (
        _endpointName: string,
        queryArg: unknown,
        updater: (draft: unknown) => void
      ) => {
        const entry = entries.find((item) => item.queryArg === queryArg);
        if (entry) {
          updater(entry.draft);
        }
        return {type: "testApi/updateQueryData"};
      },
    },
    // biome-ignore lint/suspicious/noExplicitAny: Test double covers only RTK Query util methods used here.
  } as unknown as Api<any, any, any, any>;

  return {
    api,
    dispatch: (action: unknown): void => {
      dispatched.push(action);
    },
    entries,
    getState: (): unknown => ({
      testApi: {
        queries: {
          "getTodos({completed:false})": {originalArgs: filteredQueryArg},
          "getTodos(undefined)": {originalArgs: undefined},
        },
      },
    }),
  };
};

describe("offlineOptimistic", () => {
  it("applies default optimistic creates to every cached list", () => {
    const harness = createCacheHarness();
    const mutation = createTestQueuedMutation({
      args: {body: {title: "New"}},
      endpointName: "postTodos",
      id: "queue-1",
      operation: "create",
      type: "create",
    });

    applyOptimisticUpdate(harness.api, harness.dispatch, harness.getState, mutation, "todos");

    for (const entry of harness.entries) {
      expect(entry.draft.data[0]).toMatchObject({
        _id: "temp-queue-1",
        id: "temp-queue-1",
        title: "New",
      });
    }
  });

  it("removes optimistic temp items from every cached list", () => {
    const harness = createCacheHarness();
    for (const entry of harness.entries) {
      entry.draft.data = [
        {_id: "temp-queue-1", title: "Temp"},
        {_id: "client-id", title: "Optimistic"},
        {_id: "todo-1", title: "Keep"},
      ];
    }
    const mutation = createTestQueuedMutation({
      endpointName: "postTodos",
      id: "queue-1",
      optimisticId: "client-id",
    });

    removeOptimisticTempItems(
      harness.api,
      harness.dispatch,
      harness.getState,
      [mutation],
      ["todos"]
    );

    for (const entry of harness.entries) {
      expect(entry.draft.data).toEqual([{_id: "todo-1", title: "Keep"}]);
    }
  });

  it("patches cached list documents with the server document", () => {
    const harness = createCacheHarness();

    patchCacheWithServerDocument(harness.api, harness.dispatch, harness.getState, "todos", {
      _id: "todo-1",
      completed: true,
      title: "Server title",
    });

    expect(harness.entries[0].draft.data[0]).toEqual({
      _id: "todo-1",
      completed: true,
      title: "Server title",
    });
    expect(harness.entries[1].draft.data[0]).toEqual({
      _id: "todo-1",
      completed: true,
      title: "Server title",
    });
  });
});
