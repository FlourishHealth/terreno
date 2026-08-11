import {afterEach, describe, expect, it} from "bun:test";
import type {Socket} from "socket.io-client";

import type {RealtimeEvent} from "./realtime";

const {getRealtimeSocket, realtimeDocument, realtimeList, setRealtimeSocket} = await import(
  "./realtime"
);

/** Acknowledgement payload the server sends after a query subscription. */
interface MockQuerySubscribedPayload {
  clientQueryId?: string;
  collection: string;
  queryId: string;
}

type MockSocketPayload = RealtimeEvent | MockQuerySubscribedPayload;

type MockSocketHandler = (payload: MockSocketPayload) => void;

interface MockSocket {
  emitted: Array<{event: string; payload: unknown}>;
  emit: (event: string, payload: unknown) => void;
  off: (event: string, handler: MockSocketHandler) => void;
  on: (event: string, handler: MockSocketHandler) => void;
  trigger: (event: string, payload: MockSocketPayload) => void;
}

/** Cache draft for a single document endpoint. */
interface MockDocumentDraft {
  _id?: string;
  id?: string;
  title?: string;
  updated?: string;
  [key: string]: unknown;
}

/** Cache draft for a list endpoint. */
interface MockListDraft {
  data: MockDocumentDraft[];
  total?: number;
  [key: string]: unknown;
}

interface MockCacheApi<TDraft> {
  cacheDataLoaded: Promise<void>;
  cacheEntryRemoved: Promise<void>;
  remove: () => void;
  updateCachedData: (callback: (draft: TDraft) => void) => void;
}

const createDeferred = (): {promise: Promise<void>; resolve: () => void} => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return {promise, resolve};
};

const createMockSocket = (canonicalQueryId?: string): MockSocket => {
  const listeners = new Map<string, Set<MockSocketHandler>>();
  const socket: MockSocket = {
    emit: (event, payload) => {
      socket.emitted.push({event, payload});
      if (event !== "subscribe:query" || !canonicalQueryId) {
        return;
      }
      queueMicrotask(() => {
        const handlers = listeners.get("query:subscribed") ?? new Set<MockSocketHandler>();
        const {collection} = payload as {collection: string};
        for (const handler of handlers) {
          handler({collection, queryId: canonicalQueryId});
        }
      });
    },
    emitted: [],
    off: (event, handler) => {
      listeners.get(event)?.delete(handler);
    },
    on: (event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(handler);
    },
    trigger: (event, payload) => {
      const handlers = listeners.get(event) ?? new Set<MockSocketHandler>();
      for (const handler of handlers) {
        handler(payload);
      }
    },
  };
  return socket;
};

const createCacheApi = <TDraft>(draft: TDraft): MockCacheApi<TDraft> => {
  const cacheEntryRemoved = createDeferred();
  return {
    cacheDataLoaded: Promise.resolve(),
    cacheEntryRemoved: cacheEntryRemoved.promise,
    remove: cacheEntryRemoved.resolve,
    updateCachedData: (callback): void => {
      callback(draft);
    },
  };
};

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("realtimeDocument", () => {
  afterEach(() => {
    setRealtimeSocket(null);
  });

  it("waits for a socket, patches matching update payloads, and unsubscribes", async () => {
    const draft: MockDocumentDraft = {id: "doc-1", title: "Old"};
    const api = createCacheApi(draft);
    const task = realtimeDocument("todos")("doc-1", api);

    await Promise.resolve();
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);
    await flushPromises();

    socket.trigger("sync", {
      collection: "other",
      data: {_id: "doc-1", title: "Ignored"},
      id: "doc-1",
      method: "update",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      data: {_id: "doc-2", title: "Ignored"},
      id: "doc-2",
      method: "update",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      data: {_id: "doc-1", title: "New"},
      id: "doc-1",
      method: "update",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      id: "doc-1",
      method: "delete",
      model: "Todo",
      timestamp: 1,
    });

    expect(draft).toEqual({_id: "doc-1", id: "doc-1", title: "New"});
    api.remove();
    await task;

    expect(socket.emitted).toContainEqual({
      event: "subscribe:document",
      payload: {collection: "todos", id: "doc-1"},
    });
    expect(socket.emitted).toContainEqual({
      event: "unsubscribe:document",
      payload: {collection: "todos", id: "doc-1"},
    });
  });

  it("returns before subscribing when id or cache load is unavailable", async () => {
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);

    await realtimeDocument("todos")({}, createCacheApi({}));
    await realtimeDocument("todos")("doc-1", {
      cacheDataLoaded: Promise.reject(new Error("missing")),
      cacheEntryRemoved: Promise.resolve(),
      updateCachedData: () => undefined,
    });

    expect(socket.emitted).toEqual([]);
  });

  it("returns early when socket resolves to null before subscribing", async () => {
    setRealtimeSocket(null);
    const removed = createDeferred();
    const task = realtimeDocument("todos")("doc-1", {
      cacheDataLoaded: Promise.resolve(),
      cacheEntryRemoved: removed.promise,
      updateCachedData: () => undefined,
    });
    await Promise.resolve();
    removed.resolve();
    await task;
    // No socket → no subscription events
  });

  it("logs sync events when websockets debug is enabled", async () => {
    const {setRealtimeDebug} = await import("./constants");
    const originalInfo = console.info;
    const calls: unknown[][] = [];
    console.info = (...args: unknown[]): void => {
      calls.push(args);
    };

    setRealtimeDebug(true);
    try {
      const draft: MockDocumentDraft = {id: "doc-1", title: "Old"};
      const api = createCacheApi(draft);
      const socket = createMockSocket();
      setRealtimeSocket(socket as unknown as Socket);
      const task = realtimeDocument("todos")("doc-1", api);
      await flushPromises();

      socket.trigger("sync", {
        collection: "todos",
        data: {_id: "doc-1", title: "New"},
        id: "doc-1",
        method: "update",
        model: "Todo",
        timestamp: 1,
      });

      expect(calls.some((c) => (c[0] as string)?.includes("[websocket]"))).toBe(true);

      api.remove();
      await task;
    } finally {
      setRealtimeDebug(false);
      console.info = originalInfo;
    }
  });
});

describe("realtimeList", () => {
  afterEach(() => {
    setRealtimeSocket(null);
  });

  it("unsubscribes from the server-canonical queryId", async () => {
    const cacheEntryRemoved = createDeferred();
    const socket = createMockSocket('todos:{"completed":false,"ownerId":"user1"}');
    setRealtimeSocket(socket as unknown as Socket);

    const task = realtimeList("todos")(
      {completed: false, limit: 20},
      {
        cacheDataLoaded: Promise.resolve(),
        cacheEntryRemoved: cacheEntryRemoved.promise,
        updateCachedData: () => undefined,
      }
    );

    await Promise.resolve();
    await Promise.resolve();
    cacheEntryRemoved.resolve();
    await task;

    const unsubscribed = socket.emitted.find((item) => item.event === "unsubscribe:query");
    expect(unsubscribed?.payload).toEqual({
      queryId: 'todos:{"completed":false,"ownerId":"user1"}',
    });
  });

  it("handles model-room create, update, stale update, insert-on-update, and delete events", async () => {
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);
    const draft: MockListDraft = {
      data: [{id: "todo-1", title: "Existing", updated: "2026-01-02T00:00:00.000Z"}],
      total: 1,
    };
    const api = createCacheApi(draft);
    const task = realtimeList("todos")({limit: 20}, api);

    await flushPromises();

    socket.trigger("sync", {
      collection: "other",
      data: {_id: "ignored"},
      id: "ignored",
      method: "create",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      data: {_id: "todo-2", title: "Created"},
      id: "todo-2",
      method: "create",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      data: {id: "todo-1", title: "Stale", updated: "2026-01-01T00:00:00.000Z"},
      id: "todo-1",
      method: "update",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      data: {id: "todo-1", title: "Updated", updated: "2026-01-03T00:00:00.000Z"},
      id: "todo-1",
      method: "update",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      data: {id: "todo-3", title: "New match"},
      id: "todo-3",
      method: "update",
      model: "Todo",
      timestamp: 1,
    });
    socket.trigger("sync", {
      collection: "todos",
      id: "todo-2",
      method: "delete",
      model: "Todo",
      timestamp: 1,
    });

    expect(draft.data.map((item) => item.id)).toEqual(["todo-3", "todo-1"]);
    expect(draft.data[1].title).toBe("Updated");
    expect(draft.total).toBe(2);

    api.remove();
    await task;
    expect(socket.emitted).toContainEqual({event: "subscribe:model", payload: "todos"});
    expect(socket.emitted).toContainEqual({event: "unsubscribe:model", payload: "todos"});
  });

  it("correlates query subscription acknowledgements before using canonical queryId", async () => {
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);
    const api = createCacheApi<MockListDraft>({data: [], total: 0});
    const task = realtimeList("todos")({completed: false}, api);

    await flushPromises();

    socket.trigger("query:subscribed", {
      collection: "other",
      queryId: "wrong-collection",
    });
    socket.trigger("query:subscribed", {
      clientQueryId: 'todos:{"completed":true}',
      collection: "todos",
      queryId: "wrong-client",
    });
    socket.trigger("query:subscribed", {
      clientQueryId: 'todos:{"completed":false}',
      collection: "todos",
      queryId: 'todos:{"completed":false,"ownerId":"owner-1"}',
    });

    api.remove();
    await task;

    expect(socket.emitted).toContainEqual({
      event: "unsubscribe:query",
      payload: {queryId: 'todos:{"completed":false,"ownerId":"owner-1"}'},
    });
  });

  it("returns before subscribing when cache load fails or socket never arrives", async () => {
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);
    await realtimeList("todos")(
      {},
      {
        cacheDataLoaded: Promise.reject(new Error("missing")),
        cacheEntryRemoved: Promise.resolve(),
        updateCachedData: () => undefined,
      }
    );
    expect(socket.emitted).toEqual([]);

    setRealtimeSocket(null);
    const removed = createDeferred();
    const task = realtimeList("todos")(
      {},
      {
        cacheDataLoaded: Promise.resolve(),
        cacheEntryRemoved: removed.promise,
        updateCachedData: () => undefined,
      }
    );
    await Promise.resolve();
    removed.resolve();
    await task;
  });

  it("logs sync events when websockets debug is enabled", async () => {
    const {setRealtimeDebug} = await import("./constants");
    const originalInfo = console.info;
    const calls: unknown[][] = [];
    console.info = (...args: unknown[]): void => {
      calls.push(args);
    };

    setRealtimeDebug(true);
    try {
      const socket = createMockSocket();
      setRealtimeSocket(socket as unknown as Socket);
      const draft: MockListDraft = {data: [{id: "todo-1", title: "Existing"}], total: 1};
      const api = createCacheApi(draft);
      const task = realtimeList("todos")({limit: 20}, api);

      await flushPromises();

      socket.trigger("sync", {
        collection: "todos",
        data: {_id: "todo-2", title: "Created"},
        id: "todo-2",
        method: "create",
        model: "Todo",
        timestamp: 1,
      });

      expect(calls.some((c) => (c[0] as string)?.includes("[websocket]"))).toBe(true);

      api.remove();
      await task;
    } finally {
      setRealtimeDebug(false);
      console.info = originalInfo;
    }
  });
});

describe("getRealtimeSocket", () => {
  afterEach(() => {
    setRealtimeSocket(null);
  });

  it("returns null when no socket has been set", () => {
    setRealtimeSocket(null);
    expect(getRealtimeSocket()).toBeNull();
  });

  it("returns the socket after setRealtimeSocket is called", () => {
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);
    expect(getRealtimeSocket()).toBe(socket as unknown as Socket);
  });

  it("returns null after socket is cleared", () => {
    const socket = createMockSocket();
    setRealtimeSocket(socket as unknown as Socket);
    expect(getRealtimeSocket()).toBe(socket as unknown as Socket);
    setRealtimeSocket(null);
    expect(getRealtimeSocket()).toBeNull();
  });
});
