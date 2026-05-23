// biome-ignore-all lint/suspicious/noExplicitAny: realtime RTK tests mock Socket.io and RTK Query runtime shapes
import {afterEach, describe, expect, it} from "bun:test";

const {realtimeList, setRealtimeSocket} = await import("./realtime");

interface MockSocket {
  emitted: Array<{event: string; payload: any}>;
  emit: (event: string, payload: any) => void;
  off: (event: string, handler: (payload: any) => void) => void;
  on: (event: string, handler: (payload: any) => void) => void;
}

const createDeferred = (): {promise: Promise<void>; resolve: () => void} => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return {promise, resolve};
};

const createMockSocket = (canonicalQueryId: string): MockSocket => {
  const listeners = new Map<string, Set<(payload: any) => void>>();
  const socket: MockSocket = {
    emit: (event, payload) => {
      socket.emitted.push({event, payload});
      if (event !== "subscribe:query") {
        return;
      }
      queueMicrotask(() => {
        const handlers = listeners.get("query:subscribed") ?? new Set();
        for (const handler of handlers) {
          handler({collection: payload.collection, queryId: canonicalQueryId});
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
  };
  return socket;
};

describe("realtimeList", () => {
  afterEach(() => {
    setRealtimeSocket(null);
  });

  it("unsubscribes from the server-canonical queryId", async () => {
    const cacheEntryRemoved = createDeferred();
    const socket = createMockSocket('todos:{"completed":false,"ownerId":"user1"}');
    setRealtimeSocket(socket as any);

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
});
