import {beforeEach, describe, expect, it, mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "web"},
  StyleSheet: {create: (styles: unknown) => styles},
}));
mock.module("../platform", () => ({IsWeb: true}));

let authToken: string | null = null;
mock.module("../authSlice", () => ({
  getAuthToken: async () => authToken,
}));
mock.module("../constants", () => ({baseUrl: "http://localhost:4000"}));

const {configureStore} = await import("@reduxjs/toolkit");
const {createApi, fetchBaseQuery} = await import("@reduxjs/toolkit/query");
const {createOfflineMiddleware} = await import("../offlineMiddleware");
const {selectConflicts, selectIsOnline, selectIsSyncing, selectOfflineQueue, setOnlineStatus} =
  await import("../offlineSlice");

interface TodoRecord {
  _id?: string;
  id?: string;
  title: string;
  completed?: boolean;
}

interface ListResponse {
  data: TodoRecord[];
}

type TestStore = ReturnType<typeof createTestStore>;

const createResponse = ({
  data = {data: {_id: "123", title: "Synced"}},
  status = 200,
}: {
  data?: unknown;
  status?: number;
} = {}) => ({
  json: () => Promise.resolve(data),
  status,
});

const mockFetch = mock(() => Promise.resolve(createResponse()));
globalThis.fetch = mockFetch as unknown as typeof fetch;

const api = createApi({
  baseQuery: fetchBaseQuery({baseUrl: "http://localhost:4000"}),
  endpoints: (builder) => ({
    deleteTodosById: builder.mutation({
      query: (args: {id: string}) => ({
        method: "DELETE",
        url: `/todos/${args.id}`,
      }),
    }),
    getPutTodos: builder.query<ListResponse, Record<string, unknown> | undefined>({
      query: () => "/todos",
    }),
    getTodos: builder.query<ListResponse, Record<string, unknown> | undefined>({
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
      query: (args: {body: Record<string, unknown>}) => ({
        body: args.body,
        method: "POST",
        url: "/todos",
      }),
    }),
  }),
  reducerPath: "terreno-rtk",
});

const createTestStore = (endpoints = ["postTodos", "patchTodosById", "deleteTodosById"]) => {
  const offline = createOfflineMiddleware({
    // biome-ignore lint/suspicious/noExplicitAny: Generic API type is intentionally broad.
    api: api as any,
    endpoints,
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

const waitForEffects = async (ms = 0): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const queueRejectedMutation = (
  store: TestStore,
  {
    endpointName = "patchTodosById",
    error = {message: "fetch failed"},
    originalArgs = {body: {title: "Updated"}, id: "123"},
    payload = {error: "Network error", status: "FETCH_ERROR"},
  }: {
    endpointName?: string;
    error?: Record<string, unknown>;
    originalArgs?: unknown;
    payload?: unknown;
  } = {}
): void => {
  store.dispatch({
    error,
    meta: {
      arg: {
        endpointName,
        originalArgs,
      },
    },
    payload,
    type: "terreno-rtk/executeMutation/rejected",
  });
};

const goOfflineAndQueue = (
  store: TestStore,
  mutation?: Parameters<typeof queueRejectedMutation>[1]
): void => {
  store.dispatch(setOnlineStatus(false));
  queueRejectedMutation(store, mutation);
};

const syncQueuedMutations = async (store: TestStore, ms = 120): Promise<void> => {
  store.dispatch(setOnlineStatus(true));
  await waitForEffects(ms);
};

const getFetchCall = (index = 0): [string, RequestInit] =>
  mockFetch.mock.calls[index] as unknown as [string, RequestInit];

const seedTodosCache = async (
  store: TestStore,
  args: Record<string, unknown> | undefined,
  todos: TodoRecord[]
): Promise<void> => {
  store.dispatch(api.util.upsertQueryData("getTodos", args, {data: todos}));
  await waitForEffects();
};

const getCachedTodos = (
  store: TestStore,
  args: Record<string, unknown> | undefined
): TodoRecord[] =>
  api.endpoints.getTodos.select(args)(store.getState() as unknown as never).data?.data ?? [];

describe("createOfflineMiddleware", () => {
  let store: TestStore;

  beforeEach(() => {
    store = createTestStore();
    authToken = null;
    mockFetch.mockReset();
    mockFetch.mockImplementation(() => Promise.resolve(createResponse()));
  });

  describe("network monitoring", () => {
    it("responds to explicit online and offline status changes", () => {
      store.dispatch(setOnlineStatus(false));
      expect(selectIsOnline(store.getState())).toBe(false);

      store.dispatch(setOnlineStatus(true));
      expect(selectIsOnline(store.getState())).toBe(true);
    });

    it("does not set up web event listeners (web uses useServerStatus)", async () => {
      const addedEvents: string[] = [];
      const globalWithDom = globalThis as unknown as {navigator?: unknown; window?: unknown};
      const originalWindow = globalWithDom.window;

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          addEventListener: (event: string) => {
            addedEvents.push(event);
          },
          removeEventListener: () => {},
        },
      });

      try {
        const webStore = createTestStore();
        webStore.dispatch({type: "init-network-monitoring"});
        await waitForEffects();

        expect(addedEvents).not.toContain("online");
        expect(addedEvents).not.toContain("offline");
      } finally {
        Object.defineProperty(globalThis, "window", {
          configurable: true,
          value: originalWindow,
        });
      }
    });
  });

  describe("mutation queueing", () => {
    it("queues a configured mutation when offline and a FETCH_ERROR arrives", () => {
      goOfflineAndQueue(store);

      const queue = selectOfflineQueue(store.getState());
      expect(queue).toHaveLength(1);
      expect(queue[0].endpointName).toBe("patchTodosById");
      expect(queue[0].type).toBe("update");
      expect(queue[0].args).toEqual({body: {title: "Updated"}, id: "123"});
    });

    it("queues mutations on network errors even when the browser reports online", () => {
      store.dispatch(setOnlineStatus(true));
      queueRejectedMutation(store, {
        error: {message: "Failed to fetch", name: "TypeError"},
        payload: {error: "TypeError: Failed to fetch", status: "FETCH_ERROR"},
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(1);
      expect(selectIsOnline(store.getState())).toBe(false);
    });

    it("does not queue auth-related FETCH_ERROR responses when online", () => {
      queueRejectedMutation(store, {
        error: {message: "No token found for postTodos"},
        payload: {error: "No token found for postTodos", status: "FETCH_ERROR"},
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not queue non-network errors when online", () => {
      queueRejectedMutation(store, {
        error: {message: "Validation error"},
        payload: {data: {message: "Validation error"}, status: 400},
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("marks offline when a query fails with a network error while online", () => {
      store.dispatch(setOnlineStatus(true));
      store.dispatch({
        error: {message: "Failed to fetch", name: "TypeError"},
        meta: {arg: {endpointName: "getTodos", originalArgs: {}}},
        payload: {error: "TypeError: Failed to fetch", status: "FETCH_ERROR"},
        type: "terreno-rtk/executeQuery/rejected",
      });

      expect(selectIsOnline(store.getState())).toBe(false);
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not queue unconfigured endpoint failures", () => {
      store.dispatch(setOnlineStatus(false));
      queueRejectedMutation(store, {
        endpointName: "someOtherMutation",
        originalArgs: {foo: "bar"},
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not queue non-network errors while offline", () => {
      store.dispatch(setOnlineStatus(false));
      queueRejectedMutation(store, {
        error: {message: "Validation error"},
        payload: {data: {message: "Validation error"}, status: 400},
      });

      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("recognizes fetch, network, and TypeError failure shapes", () => {
      store.dispatch(setOnlineStatus(false));
      queueRejectedMutation(store, {error: {message: "fetch failed"}});
      queueRejectedMutation(store, {error: {message: "network unavailable"}});
      queueRejectedMutation(store, {error: {name: "TypeError"}});

      expect(selectOfflineQueue(store.getState())).toHaveLength(3);
    });

    it("infers create, update, delete, and default update mutation types", () => {
      store.dispatch(setOnlineStatus(false));
      queueRejectedMutation(store, {
        endpointName: "postTodos",
        originalArgs: {body: {title: "New"}},
      });
      queueRejectedMutation(store, {
        endpointName: "patchTodosById",
        originalArgs: {body: {title: "Updated"}, id: "123"},
      });
      queueRejectedMutation(store, {
        endpointName: "deleteTodosById",
        originalArgs: {id: "123"},
      });

      const queue = selectOfflineQueue(store.getState());
      expect(queue.map((mutation) => mutation.type)).toEqual(["create", "update", "delete"]);
    });

    it("defaults configured non-standard mutation names to update", () => {
      const putStore = createTestStore(["putTodos"]);
      putStore.dispatch(setOnlineStatus(false));
      queueRejectedMutation(putStore, {
        endpointName: "putTodos",
        originalArgs: {body: {title: "Put update"}, id: "123"},
      });

      expect(selectOfflineQueue(putStore.getState())[0].type).toBe("update");
    });
  });

  describe("optimistic cache updates", () => {
    it("adds optimistic creates to every active list cache entry", async () => {
      await seedTodosCache(store, {}, [{id: "1", title: "Existing"}]);
      await seedTodosCache(store, {completed: false}, [{id: "2", title: "Filtered"}]);

      goOfflineAndQueue(store, {
        endpointName: "postTodos",
        originalArgs: {body: {completed: false, title: "Offline new"}},
      });

      const allTodos = getCachedTodos(store, {});
      const filteredTodos = getCachedTodos(store, {completed: false});
      expect(allTodos[0]).toMatchObject({completed: false, title: "Offline new"});
      expect(allTodos[0].id).toStartWith("temp-postTodos-");
      expect(filteredTodos[0]).toMatchObject({completed: false, title: "Offline new"});
    });

    it("updates optimistic changes by either id or _id across all list cache entries", async () => {
      await seedTodosCache(store, {}, [
        {_id: "mongo-id", title: "By mongo id"},
        {id: "plain-id", title: "By plain id"},
      ]);

      goOfflineAndQueue(store, {
        originalArgs: {body: {completed: true, title: "Updated mongo"}, id: "mongo-id"},
      });
      queueRejectedMutation(store, {
        originalArgs: {body: {completed: true, title: "Updated plain"}, id: "plain-id"},
      });

      expect(getCachedTodos(store, {})).toEqual([
        {_id: "mongo-id", completed: true, title: "Updated mongo"},
        {completed: true, id: "plain-id", title: "Updated plain"},
      ]);
    });

    it("ignores optimistic updates for missing ids or bodies without changing cached lists", async () => {
      const originalTodos = [{id: "1", title: "Existing"}];
      await seedTodosCache(store, {}, originalTodos);

      store.dispatch(setOnlineStatus(false));
      queueRejectedMutation(store, {originalArgs: {body: {title: "No id"}}});
      queueRejectedMutation(store, {originalArgs: {id: "1"}});

      expect(getCachedTodos(store, {})).toEqual(originalTodos);
    });

    it("removes optimistic deletes from every active list cache entry", async () => {
      await seedTodosCache(store, {}, [
        {id: "1", title: "Keep"},
        {_id: "2", title: "Delete by _id"},
        {id: "3", title: "Delete by id"},
      ]);

      goOfflineAndQueue(store, {
        endpointName: "deleteTodosById",
        originalArgs: {id: "2"},
      });
      queueRejectedMutation(store, {
        endpointName: "deleteTodosById",
        originalArgs: {id: "3"},
      });

      expect(getCachedTodos(store, {})).toEqual([{id: "1", title: "Keep"}]);
    });

    it("does not throw when no matching list cache is active", () => {
      expect(() =>
        goOfflineAndQueue(store, {
          endpointName: "postTodos",
          originalArgs: {body: {title: "No cache"}},
        })
      ).not.toThrow();
      expect(selectOfflineQueue(store.getState())).toHaveLength(1);
    });
  });

  describe("sync on reconnect", () => {
    it("replays creates with POST, JSON body, auth header, and no conflict headers", async () => {
      authToken = "auth-token";
      goOfflineAndQueue(store, {
        endpointName: "postTodos",
        originalArgs: {body: {completed: false, title: "Created offline"}},
      });

      await syncQueuedMutations(store);

      const [url, options] = getFetchCall();
      const headers = options.headers as Record<string, string>;
      expect(url).toBe("http://localhost:4000/todos");
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({completed: false, title: "Created offline"}));
      expect(headers.authorization).toBe("Bearer auth-token");
      expect(headers["If-Unmodified-Since"]).toBeUndefined();
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("replays updates with PATCH, JSON body, HTTP-date and precise timestamp headers", async () => {
      goOfflineAndQueue(store, {
        endpointName: "patchTodosById",
        originalArgs: {body: {title: "Updated offline"}, id: "123"},
      });

      await syncQueuedMutations(store);

      const [url, options] = getFetchCall();
      const headers = options.headers as Record<string, string>;
      expect(url).toBe("http://localhost:4000/todos/123");
      expect(options.method).toBe("PATCH");
      expect(options.body).toBe(JSON.stringify({title: "Updated offline"}));
      expect(headers["If-Unmodified-Since"]).toContain("GMT");
      expect(new Date(headers["X-Unmodified-Since-ISO"]).toISOString()).toBe(
        headers["X-Unmodified-Since-ISO"]
      );
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("replays deletes with DELETE and handles 204 without parsing JSON", async () => {
      mockFetch.mockImplementationOnce(() => Promise.resolve(createResponse({status: 204})));
      goOfflineAndQueue(store, {
        endpointName: "deleteTodosById",
        originalArgs: {id: "123"},
      });

      await syncQueuedMutations(store);

      const [url, options] = getFetchCall();
      expect(url).toBe("http://localhost:4000/todos/123");
      expect(options.method).toBe("DELETE");
      expect(options.body).toBeUndefined();
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not replay when coming online with an empty queue", async () => {
      store.dispatch(setOnlineStatus(false));
      await syncQueuedMutations(store, 50);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("does not replay while staying offline", async () => {
      goOfflineAndQueue(store);
      store.dispatch(setOnlineStatus(false));
      await waitForEffects(50);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(selectOfflineQueue(store.getState())).toHaveLength(1);
    });

    it("replays multiple mutations in FIFO order", async () => {
      goOfflineAndQueue(store, {
        endpointName: "postTodos",
        originalArgs: {body: {title: "First"}},
      });
      queueRejectedMutation(store, {
        endpointName: "patchTodosById",
        originalArgs: {body: {completed: true}, id: "456"},
      });
      queueRejectedMutation(store, {
        endpointName: "deleteTodosById",
        originalArgs: {id: "789"},
      });

      await syncQueuedMutations(store);

      expect(
        mockFetch.mock.calls.map((call) =>
          ((call as unknown[])[0] as string).replace(baseUrlForTest, "")
        )
      ).toEqual(["/todos", "/todos/456", "/todos/789"]);
    });

    it("sets syncing during replay and clears it after success", async () => {
      mockFetch.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(createResponse({status: 200})), 50))
      );
      goOfflineAndQueue(store, {
        endpointName: "postTodos",
        originalArgs: {body: {title: "New"}},
      });

      store.dispatch(setOnlineStatus(true));
      await waitForEffects(10);
      expect(selectIsSyncing(store.getState())).toBe(true);

      await waitForEffects(100);
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("creates a conflict record from wrapped 409 server data and dequeues the mutation", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve(
          createResponse({
            data: {
              data: {_id: "123", completed: false, title: "Remote version"},
              error: "Conflict",
              message: "Document was modified since your last read",
            },
            status: 409,
          })
        )
      );
      goOfflineAndQueue(store, {
        originalArgs: {body: {completed: true}, id: "123"},
      });

      await syncQueuedMutations(store);

      const conflicts = selectConflicts(store.getState());
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]).toMatchObject({
        args: {body: {completed: true}, id: "123"},
        dismissed: false,
        endpointName: "patchTodosById",
        serverDocument: {_id: "123", completed: false, title: "Remote version"},
      });
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("creates a conflict record from raw 409 data when the server does not wrap data", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve(createResponse({data: {_id: "123", title: "Raw remote"}, status: 409}))
      );
      goOfflineAndQueue(store);

      await syncQueuedMutations(store);

      expect(selectConflicts(store.getState())[0].serverDocument).toEqual({
        _id: "123",
        title: "Raw remote",
      });
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("continues replaying after a conflict so later local changes still sync", async () => {
      mockFetch
        .mockImplementationOnce(() =>
          Promise.resolve(createResponse({data: {data: {_id: "1", title: "Remote"}}, status: 409}))
        )
        .mockImplementationOnce(() => Promise.resolve(createResponse()));
      goOfflineAndQueue(store, {
        originalArgs: {body: {title: "Conflicting local"}, id: "1"},
      });
      queueRejectedMutation(store, {
        originalArgs: {body: {title: "Later local"}, id: "2"},
      });

      await syncQueuedMutations(store);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(selectConflicts(store.getState())).toHaveLength(1);
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("dequeues permanent non-conflict 4xx failures to avoid infinite retry loops", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve(createResponse({data: {message: "Forbidden"}, status: 403}))
      );
      goOfflineAndQueue(store);

      await syncQueuedMutations(store);

      expect(selectConflicts(store.getState())).toHaveLength(0);
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("leaves 5xx failures queued for a future reconnect", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve(createResponse({data: {message: "Server error"}, status: 500}))
      );
      goOfflineAndQueue(store);

      await syncQueuedMutations(store);

      expect(selectOfflineQueue(store.getState())).toHaveLength(1);
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("stops replay after a thrown network error and preserves later mutations", async () => {
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error("network down")))
        .mockImplementationOnce(() => Promise.resolve(createResponse()));
      goOfflineAndQueue(store, {
        originalArgs: {body: {title: "First"}, id: "1"},
      });
      queueRejectedMutation(store, {
        originalArgs: {body: {title: "Second"}, id: "2"},
      });

      await syncQueuedMutations(store);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(selectOfflineQueue(store.getState()).map((mutation) => mutation.args)).toEqual([
        {body: {title: "First"}, id: "1"},
        {body: {title: "Second"}, id: "2"},
      ]);
      expect(selectIsSyncing(store.getState())).toBe(false);
    });

    it("retries preserved mutations on a later online event after a transient failure", async () => {
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error("network down")))
        .mockImplementation(() => Promise.resolve(createResponse()));
      goOfflineAndQueue(store);

      await syncQueuedMutations(store);
      expect(selectOfflineQueue(store.getState())).toHaveLength(1);

      store.dispatch(setOnlineStatus(false));
      await syncQueuedMutations(store);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("does not start concurrent replay for repeated online events", async () => {
      mockFetch.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve(createResponse({status: 200})), 50))
      );
      goOfflineAndQueue(store);

      store.dispatch(setOnlineStatus(true));
      store.dispatch(setOnlineStatus(true));
      store.dispatch(setOnlineStatus(true));
      await waitForEffects(120);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(selectOfflineQueue(store.getState())).toHaveLength(0);
    });

    it("handles response JSON parse failures like transient replay failures", async () => {
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          json: () => Promise.reject(new Error("invalid json")),
          status: 502,
        })
      );
      goOfflineAndQueue(store);

      await syncQueuedMutations(store);

      expect(selectOfflineQueue(store.getState())).toHaveLength(1);
      expect(selectIsSyncing(store.getState())).toBe(false);
    });
  });
});

const baseUrlForTest = "http://localhost:4000";
