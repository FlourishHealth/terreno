import {describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";
import {Provider} from "react-redux";
import type {Socket} from "socket.io-client";

import type {RealtimeEvent} from "./realtime";
import {useSyncConnection} from "./sync";

const REDUCER_PATH = "testApi";

type SocketHandler = (arg?: unknown) => void;

interface FakeSocket {
  connected: boolean;
  emit: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  off: ReturnType<typeof mock>;
  trigger: (event: string, arg?: unknown) => void;
}

const createFakeSocket = (connected: boolean): FakeSocket => {
  const handlers: Record<string, SocketHandler[]> = {};
  return {
    connected,
    emit: mock(() => {}),
    off: mock((event: string, cb: SocketHandler) => {
      handlers[event] = (handlers[event] ?? []).filter((h) => h !== cb);
    }),
    on: mock((event: string, cb: SocketHandler) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(cb);
    }),
    trigger: (event: string, arg?: unknown) => {
      for (const cb of handlers[event] ?? []) {
        cb(arg);
      }
    },
  };
};

interface QueryEntry {
  status: string;
  endpointName: string;
  originalArgs: unknown;
  data?: Record<string, unknown>;
}

const createApi = (queries: Record<string, QueryEntry> | null) => {
  const dataByEndpoint: Record<string, Record<string, unknown>> = {};
  if (queries) {
    for (const key of Object.keys(queries)) {
      const entry = queries[key];
      if (entry.data) {
        dataByEndpoint[entry.endpointName] = entry.data;
      }
    }
  }

  const invalidateTags = mock((tags: string[]) => ({payload: tags, type: "api/invalidateTags"}));
  const updateQueryData = mock(
    (endpointName: string, _args: unknown, recipe: (draft: Record<string, unknown>) => void) => {
      const draft = dataByEndpoint[endpointName];
      if (draft) {
        recipe(draft);
      }
      return {type: "api/updateQueryData"};
    }
  );

  const api = {
    reducerPath: REDUCER_PATH,
    util: {invalidateTags, updateQueryData},
  };

  const store = configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({immutableCheck: false, serializableCheck: false}),
    reducer: {
      [REDUCER_PATH]: (state = {queries: queries ?? undefined}) => state,
    },
  });

  return {api, invalidateTags, store, updateQueryData};
};

const renderSync = (
  socket: FakeSocket | null,
  // biome-ignore lint/suspicious/noExplicitAny: test-only structural RTK Query api stub
  api: any,
  store: ReturnType<typeof configureStore>,
  options: {tagTypes?: string[]; debug?: boolean} = {}
) => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return renderHook(
    () =>
      useSyncConnection({
        api,
        debug: options.debug ?? true,
        socket: socket as unknown as Socket,
        tagTypes: options.tagTypes ?? ["todos"],
      }),
    {wrapper: Wrapper}
  );
};

const syncEvent = (overrides: Partial<RealtimeEvent>): RealtimeEvent =>
  ({
    collection: "todos",
    id: "1",
    method: "update",
    ...overrides,
  }) as RealtimeEvent;

describe("useSyncConnection", () => {
  it("does nothing when there is no socket", () => {
    const {store, api} = createApi(null);
    const {result} = renderSync(null, api, store);
    expect(result.current).toBeUndefined();
  });

  it("subscribes to model rooms when the socket is already connected", () => {
    const socket = createFakeSocket(true);
    const {store, api} = createApi({});
    const {unmount} = renderSync(socket, api, store, {tagTypes: ["todos", "users"]});

    expect(socket.emit).toHaveBeenCalledWith("subscribe:model", "todos");
    expect(socket.emit).toHaveBeenCalledWith("subscribe:model", "users");
    expect(socket.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith("sync", expect.any(Function));

    unmount();
    expect(socket.emit).toHaveBeenCalledWith("unsubscribe:model", "todos");
    expect(socket.off).toHaveBeenCalledWith("sync", expect.any(Function));
  });

  it("subscribes on the connect event when not initially connected", () => {
    const socket = createFakeSocket(false);
    const {store, api} = createApi({});
    const {unmount} = renderSync(socket, api, store);

    expect(socket.emit).not.toHaveBeenCalledWith("subscribe:model", "todos");

    act(() => {
      socket.trigger("connect");
    });
    expect(socket.emit).toHaveBeenCalledWith("subscribe:model", "todos");

    // Not connected on cleanup, so no unsubscribe emit.
    socket.emit.mockClear();
    unmount();
    expect(socket.emit).not.toHaveBeenCalledWith("unsubscribe:model", "todos");
  });

  it("ignores events for collections that are not tracked", () => {
    const socket = createFakeSocket(true);
    const {store, api, invalidateTags} = createApi({});
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({collection: "other", method: "create"}));
    });
    expect(invalidateTags).not.toHaveBeenCalled();
  });

  it("invalidates tags for create events", () => {
    const socket = createFakeSocket(true);
    const {store, api, invalidateTags} = createApi({});
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({method: "create"}));
    });
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("invalidates tags for update events without data", () => {
    const socket = createFakeSocket(true);
    const {store, api, invalidateTags} = createApi({});
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({data: undefined, method: "update"}));
    });
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("invalidates tags for update events when there are no cached queries", () => {
    const socket = createFakeSocket(true);
    const {store, api, invalidateTags} = createApi(null);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({data: {name: "new"}, method: "update"}));
    });
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("patches a matching entity inside a cached list query on update", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getTodos()": {
        data: {data: [{_id: "1", name: "old", updated: "2026-01-01T00:00:00.000Z"}], total: 1},
        endpointName: "getTodos",
        originalArgs: undefined,
        status: "fulfilled",
      },
    };
    const {store, api, updateQueryData, invalidateTags} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger(
        "sync",
        syncEvent({data: {name: "new", updated: "2026-02-01T00:00:00.000Z"}, method: "update"})
      );
    });

    expect(updateQueryData).toHaveBeenCalled();
    expect(queries["getTodos()"].data.data[0].name).toBe("new");
    expect(invalidateTags).not.toHaveBeenCalled();
  });

  it("skips stale updates in a cached list query", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getTodos()": {
        data: {data: [{_id: "1", name: "current", updated: "2026-03-01T00:00:00.000Z"}], total: 1},
        endpointName: "getTodos",
        originalArgs: undefined,
        status: "fulfilled",
      },
    };
    const {store, api} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger(
        "sync",
        syncEvent({data: {name: "stale", updated: "2026-01-01T00:00:00.000Z"}, method: "update"})
      );
    });

    expect(queries["getTodos()"].data.data[0].name).toBe("current");
  });

  it("patches a matching single-entity cached query on update", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getTodoById(1)": {
        data: {_id: "1", name: "old", updated: "2026-01-01T00:00:00.000Z"},
        endpointName: "getTodoById",
        originalArgs: {id: "1"},
        status: "fulfilled",
      },
    };
    const {store, api, updateQueryData} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger(
        "sync",
        syncEvent({data: {name: "new", updated: "2026-02-01T00:00:00.000Z"}, method: "update"})
      );
    });

    expect(updateQueryData).toHaveBeenCalled();
    expect(queries["getTodoById(1)"].data.name).toBe("new");
  });

  it("skips stale updates for a single-entity cached query", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getTodoById(1)": {
        data: {_id: "1", name: "current", updated: "2026-03-01T00:00:00.000Z"},
        endpointName: "getTodoById",
        originalArgs: {id: "1"},
        status: "fulfilled",
      },
    };
    const {store, api, invalidateTags} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger(
        "sync",
        syncEvent({data: {name: "stale", updated: "2026-01-01T00:00:00.000Z"}, method: "update"})
      );
    });

    expect(queries["getTodoById(1)"].data.name).toBe("current");
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("invalidates tags on update when no cached query matches", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getOthers()": {
        data: {data: [{_id: "999", name: "unrelated"}]},
        endpointName: "getOthers",
        originalArgs: undefined,
        status: "fulfilled",
      },
      "pending()": {
        data: {data: [{_id: "1"}]},
        endpointName: "pending",
        originalArgs: undefined,
        status: "pending",
      },
    };
    const {store, api, invalidateTags} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({data: {name: "new"}, method: "update"}));
    });

    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("removes a deleted entity from cached list queries and decrements total", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getTodos()": {
        data: {
          data: [
            {_id: "1", name: "a"},
            {_id: "2", name: "b"},
          ],
          total: 2,
        },
        endpointName: "getTodos",
        originalArgs: undefined,
        status: "fulfilled",
      },
    };
    const {store, api, updateQueryData} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({method: "delete"}));
    });

    expect(updateQueryData).toHaveBeenCalled();
    expect(queries["getTodos()"].data.data).toHaveLength(1);
    expect(queries["getTodos()"].data.total).toBe(1);
  });

  it("invalidates tags on delete when there are no cached queries", () => {
    const socket = createFakeSocket(true);
    const {store, api, invalidateTags} = createApi(null);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({method: "delete"}));
    });
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("invalidates tags on delete when no cached query matches", () => {
    const socket = createFakeSocket(true);
    const queries = {
      "getOthers()": {
        data: {data: [{_id: "999"}]},
        endpointName: "getOthers",
        originalArgs: undefined,
        status: "fulfilled",
      },
    };
    const {store, api, invalidateTags} = createApi(queries);
    renderSync(socket, api, store);

    act(() => {
      socket.trigger("sync", syncEvent({method: "delete"}));
    });
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });

  it("does not log sync details when debug is disabled", () => {
    const socket = createFakeSocket(true);
    const {store, api, invalidateTags} = createApi({});
    renderSync(socket, api, store, {debug: false});

    act(() => {
      socket.trigger("sync", syncEvent({method: "create"}));
    });
    expect(invalidateTags).toHaveBeenCalledWith(["todos"]);
  });
});
