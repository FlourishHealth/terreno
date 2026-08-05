/**
 * Tests for RealtimeApp.onServerCreated — the Socket.io server wiring that a
 * live server would exercise. socket.io, the JWT authorize middleware, and the
 * change-stream watcher are mocked so the connection / connect_error handlers
 * can be captured and invoked without standing up a real server.
 */
import {afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";

import type http from "node:http";

type Handler = (...args: unknown[]) => void;

interface FakeIo {
  handlers: Map<string, Handler>;
  middleware: unknown[];
  closed: boolean;
}

let ios: FakeIo[] = [];
let watcherStarts = 0;

class FakeServer {
  handlers = new Map<string, Handler>();
  middleware: unknown[] = [];
  closed = false;
  engine = {clientsCount: 0};

  constructor(..._args: unknown[]) {
    ios.push(this as unknown as FakeIo);
  }

  use(mw: unknown): void {
    this.middleware.push(mw);
  }

  on(event: string, handler: Handler): void {
    this.handlers.set(event, handler);
  }

  close(cb?: () => void): void {
    this.closed = true;
    cb?.();
  }
}

mock.module("socket.io", () => ({Server: FakeServer}));
mock.module("@thream/socketio-jwt", () => ({
  authorize: (_opts: unknown) => (_socket: unknown, next: () => void) => next(),
}));
mock.module("./changeStreamWatcher", () => ({
  startChangeStreamWatcher: () => {
    watcherStarts += 1;
  },
  stopChangeStreamWatcher: () => {},
}));

let RealtimeApp: typeof import("./realtimeApp").RealtimeApp;

beforeAll(async () => {
  ({RealtimeApp} = await import("./realtimeApp"));
});

const lastIo = (): FakeIo => {
  const io = ios[ios.length - 1];
  if (!io) {
    throw new Error("No Socket.io server was created");
  }
  return io;
};

const getHandler = (event: string): Handler => {
  const handler = lastIo().handlers.get(event);
  if (!handler) {
    throw new Error(`No handler registered for ${event}`);
  }
  return handler;
};

const fakeServer = {} as http.Server;

const createConnectionSocket = (throwOnOn = false): Record<string, unknown> => {
  const listeners = new Map<string, Handler>();
  return {
    decodedToken: {admin: false, id: "user-42"},
    emit: (): void => {},
    id: "socket-1",
    join: async (): Promise<void> => {},
    leave: async (): Promise<void> => {},
    on: (event: string, handler: Handler): void => {
      if (throwOnOn) {
        throw new Error("boom");
      }
      listeners.set(event, handler);
    },
  };
};

describe("RealtimeApp.onServerCreated", () => {
  beforeEach(() => {
    ios = [];
    watcherStarts = 0;
  });

  afterEach(() => {
    delete process.env.TOKEN_SECRET;
  });

  it("wires up auth middleware, connection handlers, and the change-stream watcher", () => {
    const app = new RealtimeApp({debug: true, tokenSecret: "test-secret"});
    app.onServerCreated(fakeServer);

    const io = lastIo();
    expect(io.middleware.length).toBe(1);
    expect(io.handlers.has("connection")).toBe(true);
    expect(io.handlers.has("connect_error")).toBe(true);
    expect(watcherStarts).toBe(1);
    expect(app.getIo()).not.toBeNull();
  });

  it("installs socket handlers for each new connection", () => {
    const app = new RealtimeApp({tokenSecret: "test-secret"});
    app.onServerCreated(fakeServer);

    const connectionHandler = getHandler("connection");
    const socket = createConnectionSocket();
    // Should run installRealtimeSocketHandlers without throwing.
    expect(() => connectionHandler(socket)).not.toThrow();
  });

  it("captures errors thrown while handling a connection", () => {
    const app = new RealtimeApp({tokenSecret: "test-secret"});
    app.onServerCreated(fakeServer);

    const connectionHandler = getHandler("connection");
    const brokenSocket = createConnectionSocket(true);
    // The handler swallows the error rather than crashing the server.
    expect(() => connectionHandler(brokenSocket)).not.toThrow();
  });

  it("logs connect_error events without throwing", () => {
    const app = new RealtimeApp({tokenSecret: "test-secret"});
    app.onServerCreated(fakeServer);

    const errorHandler = getHandler("connect_error");
    expect(() => errorHandler(new Error("handshake failed"))).not.toThrow();
  });

  it("reads the token secret from the environment when not provided in config", () => {
    process.env.TOKEN_SECRET = "env-secret";
    const app = new RealtimeApp();
    app.onServerCreated(fakeServer);

    expect(lastIo().handlers.has("connection")).toBe(true);
  });

  it("throws when no token secret is available", () => {
    delete process.env.TOKEN_SECRET;
    const app = new RealtimeApp();
    expect(() => app.onServerCreated(fakeServer)).toThrow(/TOKEN_SECRET is required/);
  });
});
