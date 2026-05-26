import {describe, it} from "bun:test";
import {configureStore, type UnknownAction} from "@reduxjs/toolkit";
import type {Api} from "@reduxjs/toolkit/query/react";
import assert from "node:assert";

import {createOfflineMiddleware} from "./offlineMiddleware";
import {type OfflineState, selectOfflineQueue} from "./offlineSlice";

interface QueryEntry {
  data?: {data: Record<string, unknown>[]};
  originalArgs: unknown;
}

interface TestApiState {
  queries: Record<string, QueryEntry>;
}

interface TestState {
  offline: OfflineState;
  testApi: TestApiState;
}

const LIST_QUERY_ARGS = {};
const LIST_UPDATED_AT = "2026-05-23T21:00:00.123Z";

const initialTestApiState: TestApiState = {
  queries: {
    "getTodos({})": {
      data: {
        data: [
          {
            _id: "todo-1",
            title: "Original",
            updated: LIST_UPDATED_AT,
          },
        ],
      },
      originalArgs: LIST_QUERY_ARGS,
    },
  },
};

const testApiReducer = (state: TestApiState = initialTestApiState): TestApiState => state;

// biome-ignore lint/suspicious/noExplicitAny: Test double covers only fields used by offline middleware.
const createTestApi = (): Api<any, any, any, any> => {
  return {
    endpoints: {
      getTodos: {
        select: (queryArg: unknown) => {
          return (state: TestState): QueryEntry | undefined => {
            return Object.values(state.testApi.queries).find(
              (entry) => entry.originalArgs === queryArg
            );
          };
        },
      },
    },
    reducerPath: "testApi",
    util: {
      invalidateTags: () => ({type: "testApi/invalidateTags"}),
      updateQueryData: () => ({type: "testApi/updateQueryData"}),
    },
  } as unknown as Api<any, any, any, any>;
};

describe("offlineMiddleware", () => {
  it("uses list-cache updated timestamp for queued update conflict headers", async () => {
    const api = createTestApi();
    const offline = createOfflineMiddleware({
      api,
      endpoints: ["patchTodosById"],
    });
    const store = configureStore({
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({serializableCheck: false}).concat(offline.middleware),
      reducer: {
        offline: offline.offlineReducer,
        testApi: testApiReducer,
      },
    });

    const rejectedMutation: UnknownAction = {
      error: {message: "Network unavailable"},
      meta: {
        arg: {
          endpointName: "patchTodosById",
          originalArgs: {
            body: {title: "Queued title"},
            id: "todo-1",
          },
        },
      },
      type: "testApi/executeMutation/rejected",
    };

    store.dispatch(rejectedMutation);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const queue = selectOfflineQueue(store.getState());
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].baseUpdatedAt, LIST_UPDATED_AT);
    assert.strictEqual(queue[0].timestamp, LIST_UPDATED_AT);
  });
});
