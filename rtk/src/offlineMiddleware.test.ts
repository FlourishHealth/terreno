import {beforeEach, describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";

import {createOfflineMiddleware} from "./offlineMiddleware";
import {
  selectConflicts,
  selectIsOnline,
  selectIsSyncing,
  selectOfflineQueue,
  setOnlineStatus,
} from "./offlineSlice";

// Mock fetch for replay tests
const mockFetch = mock(() =>
  Promise.resolve({
    json: () => Promise.resolve({data: {_id: "123", title: "Synced"}}),
    status: 200,
  })
);
globalThis.fetch = mockFetch as unknown as typeof fetch;

// Create a test API
const api = createApi({
  baseQuery: fetchBaseQuery({baseUrl: "http://localhost:4000"}),
  endpoints: (builder) => ({
    deleteTodosById: builder.mutation({
      query: (args: {id: string}) => ({
        method: "DELETE",
        url: `/todos/${args.id}`,
      }),
    }),
    getTodos: builder.query({
      query: () => "/todos",
    }),
    patchTodosById: builder.mutation({
      query: (args: {id: string; body: Record<string, unknown>}) => ({
        body: args.body,
        method: "PATCH",
        url: `/todos/${args.id}`,
      }),
    }),
    postTodos: builder.mutation({
      query: (args: {body: {title: string}}) => ({
        body: args.body,
        method: "POST",
        url: "/todos",
      }),
    }),
  }),
  reducerPath: "terreno-rtk",
});

const createTestStore = () => {
  const offline = createOfflineMiddleware({
    // biome-ignore lint/suspicious/noExplicitAny: Test mock
    api: api as any,
    endpoints: ["postTodos", "patchTodosById", "deleteTodosById"],
  });

  return configureStore({
    middleware: (getDefault) =>
      getDefault({serializableCheck: false}).concat(api.middleware, offline.middleware),
    reducer: {
      [api.reducerPath]: api.reducer,
      offline: offline.offlineReducer,
    },
  });
};

describe("createOfflineMiddleware", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    mockFetch.mockClear();
  });

  describe("network monitoring", () => {
    it("responds to setOnlineStatus dispatches", () => {
      store.dispatch(setOnlineStatus(false));
      expect(selectIsOnline(store.getState())).toBe(false);

      store.dispatch(setOnlineStatus(true));
      expect(selectIsOnline(store.getState())).toBe(true);
    });
  });

  describe("mutation queueing when offline", () => {
    it("queues a mutation when offline and a rejected FETCH_ERROR arrives", () => {
      store.dispatch(setOnlineStatus(false));

      // Simulate an RTK Query mutation rejected action (the shape dispatched by RTK Query)
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {title: "Updated"}, id: "123"},
          },
        },
        payload: {error: "Network error", status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      const queue = selectOfflineQueue(store.getState());
      expect(queue).toHaveLength(1);
      expect(queue[0].endpointName).toBe("patchTodosById");
      expect(queue[0].type).toBe("update");
      expect(queue[0].args).toEqual({body: {title: "Updated"}, id: "123"});
    });

    it("does not queue mutations when online", () => {
      // Online by default
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {title: "Updated"}, id: "123"},
          },
        },
        payload: {error: "Network error", status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not queue mutations for non-configured endpoints", () => {
      store.dispatch(setOnlineStatus(false));

      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "someOtherMutation",
            originalArgs: {foo: "bar"},
          },
        },
        payload: {error: "Network error", status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not queue non-network errors when offline", () => {
      store.dispatch(setOnlineStatus(false));

      store.dispatch({
        error: {message: "Validation error"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {title: ""}, id: "123"},
          },
        },
        payload: {data: {message: "Validation error"}, status: 400},
        type: "terreno-rtk/executeMutation/rejected",
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("infers create type for post endpoints", () => {
      store.dispatch(setOnlineStatus(false));

      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "postTodos",
            originalArgs: {body: {title: "New"}},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      const queue = selectOfflineQueue(store.getState());
      expect(queue[0].type).toBe("create");
    });

    it("infers delete type for delete endpoints", () => {
      store.dispatch(setOnlineStatus(false));

      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "deleteTodosById",
            originalArgs: {id: "123"},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      const queue = selectOfflineQueue(store.getState());
      expect(queue[0].type).toBe("delete");
    });
  });

  describe("sync on reconnect", () => {
    it("replays queued mutations when coming back online", async () => {
      // Queue a mutation while offline
      store.dispatch(setOnlineStatus(false));
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {title: "Updated"}, id: "123"},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(1);

      // Come back online - triggers sync
      store.dispatch(setOnlineStatus(true));

      // Wait for async sync to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockFetch).toHaveBeenCalled();
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("sends If-Unmodified-Since header for update mutations", async () => {
      store.dispatch(setOnlineStatus(false));
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {title: "Updated"}, id: "123"},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      store.dispatch(setOnlineStatus(true));
      await new Promise((resolve) => setTimeout(resolve, 100));

      const fetchCall = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const fetchOptions = fetchCall[1];
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers["If-Unmodified-Since"]).toBeDefined();
    });

    it("creates a conflict record on 409 response", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              data: {_id: "123", title: "Server Version"},
              error: "Conflict",
              message: "Document was modified since your last read",
            }),
          status: 409,
        })
      );

      store.dispatch(setOnlineStatus(false));
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {title: "Offline"}, id: "123"},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      store.dispatch(setOnlineStatus(true));
      await new Promise((resolve) => setTimeout(resolve, 100));

      const conflicts = selectConflicts(store.getState());
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].serverDocument).toEqual({_id: "123", title: "Server Version"});
      expect(conflicts[0].endpointName).toBe("patchTodosById");
      // Should be dequeued even on conflict
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("sets isSyncing during replay", async () => {
      // Use a slow mock to observe syncing state
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  json: () => Promise.resolve({data: {} as {_id: string; title: string}}),
                  status: 200,
                }),
              50
            )
          )
      );

      store.dispatch(setOnlineStatus(false));
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "postTodos",
            originalArgs: {body: {title: "New"}},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      store.dispatch(setOnlineStatus(true));

      // Check syncing is true shortly after
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(selectIsSyncing(store.getState())).toBe(true);

      // Wait for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("does not replay when coming online with empty queue", async () => {
      store.dispatch(setOnlineStatus(false));
      store.dispatch(setOnlineStatus(true));

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("replays mutations in FIFO order", async () => {
      const fetchOrder: string[] = [];
      mockFetch.mockImplementation((...args: unknown[]) => {
        const url = args[0] as string;
        fetchOrder.push(url);
        return Promise.resolve({
          json: () => Promise.resolve({data: {_id: "new", title: "Synced"}}),
          status: url.includes("DELETE") ? 204 : 200,
        });
      });

      store.dispatch(setOnlineStatus(false));

      // Queue create, then update
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "postTodos",
            originalArgs: {body: {title: "First"}},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });
      store.dispatch({
        error: {message: "fetch failed"},
        meta: {
          arg: {
            endpointName: "patchTodosById",
            originalArgs: {body: {completed: true}, id: "456"},
          },
        },
        payload: {status: "FETCH_ERROR"},
        type: "terreno-rtk/executeMutation/rejected",
      });

      store.dispatch(setOnlineStatus(true));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(fetchOrder).toHaveLength(2);
      // First call should be POST (create), second should be PATCH (update)
      expect(fetchOrder[0]).toContain("/todos");
      expect(fetchOrder[1]).toContain("/todos/456");
    });
  });
});
