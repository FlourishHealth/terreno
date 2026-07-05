import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {createServer, type Server as HttpServer} from "node:http";
import type {AddressInfo} from "node:net";
import {Server, type Socket as ServerSocket} from "socket.io";

import type {SyncAck, SyncDelta, SyncMutateRequest, SyncNack} from "../types";
import {createSocketTransport} from "./socketTransport";
import type {SyncTransport, TransportStatus} from "./transport";

interface TestServer {
  baseUrl: string;
  io: Server;
  httpServer: HttpServer;
  /** Sockets that have connected, most recent last. */
  sockets: ServerSocket[];
  /** sync:subscribe payloads received, in order. */
  subscribes: {collections: string[]}[];
  /** Handler answering sync:mutate; replace per test. */
  mutateHandler: (request: SyncMutateRequest, socket: ServerSocket) => void;
  close: () => Promise<void>;
}

const startServer = async (): Promise<TestServer> => {
  const httpServer = createServer();
  const io = new Server(httpServer);
  const server: TestServer = {
    baseUrl: "",
    close: async () => {
      io.disconnectSockets(true);
      // Kill lingering HTTP long-polling connections so close() can complete.
      httpServer.closeAllConnections();
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    },
    httpServer,
    io,
    mutateHandler: () => {},
    sockets: [],
    subscribes: [],
  };
  io.on("connection", (socket) => {
    server.sockets.push(socket);
    socket.on("sync:subscribe", (payload: {collections: string[]}) => {
      server.subscribes.push(payload);
    });
    socket.on("sync:mutate", (request: SyncMutateRequest) => {
      server.mutateHandler(request, socket);
    });
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => resolve());
  });
  const {port} = httpServer.address() as AddressInfo;
  server.baseUrl = `http://127.0.0.1:${port}`;
  return server;
};

describe("createSocketTransport", () => {
  let server: TestServer;
  let transport: SyncTransport | undefined;
  const tokenCalls: number[] = [];

  const makeTransport = (timeoutMs?: number): SyncTransport => {
    transport = createSocketTransport({
      authProvider: {
        getToken: async () => {
          tokenCalls.push(Date.now());
          return "test-token";
        },
      },
      baseUrl: server.baseUrl,
      timeoutMs,
    });
    return transport;
  };

  beforeEach(async () => {
    tokenCalls.length = 0;
    server = await startServer();
  });

  afterEach(async () => {
    transport?.disconnect();
    transport = undefined;
    await server.close();
  });

  it("connects with the auth token from the provider and reports status", async () => {
    const statuses: TransportStatus[] = [];
    const connecting = makeTransport();
    connecting.onStatusChange((status) => statuses.push(status));
    await connecting.connect();
    expect(statuses).toEqual([{connected: true}]);
    expect(tokenCalls.length).toBeGreaterThanOrEqual(1);
    // The raw provider token is sent Bearer-prefixed, matching the server's
    // legacy JWT socket validator (and the HTTP channel's Authorization header).
    expect(server.sockets[0]?.handshake.auth.token).toBe("Bearer test-token");

    connecting.disconnect();
    // Allow the disconnect event to round-trip.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statuses).toEqual([{connected: true}, {connected: false}]);
  });

  it("connect() resolves immediately when already connected", async () => {
    const connecting = makeTransport();
    await connecting.connect();
    await connecting.connect();
    expect(server.sockets).toHaveLength(1);
  });

  it("subscribe emits sync:subscribe when connected and replays it on connect", async () => {
    const subscriber = makeTransport();
    // Subscribed before connect: sent once the connection opens.
    subscriber.subscribe(["todos"]);
    await subscriber.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.subscribes).toEqual([{collections: ["todos"]}]);

    // Subscribed while connected: sent immediately.
    subscriber.subscribe(["notes"]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.subscribes).toEqual([{collections: ["todos"]}, {collections: ["notes"]}]);
  });

  it("resolves sendMutation from an emitted sync:ack", async () => {
    server.mutateHandler = (request, socket) => {
      const ack: SyncAck = {id: request.id ?? "x", mutationId: request.mutationId, seq: 3};
      socket.emit("sync:ack", ack);
    };
    const sender = makeTransport();
    await sender.connect();
    const result = await sender.sendMutation({
      collection: "todos",
      data: {title: "a"},
      id: "t1",
      mutationId: "m1",
      operation: "create",
    });
    expect(result).toEqual({ack: {id: "t1", mutationId: "m1", seq: 3}, type: "ack"});
  });

  it("resolves sendMutation from an emitted sync:nack", async () => {
    server.mutateHandler = (request, socket) => {
      const nack: SyncNack = {code: "conflict", mutationId: request.mutationId, serverSeq: 8};
      socket.emit("sync:nack", nack);
    };
    const sender = makeTransport();
    await sender.connect();
    const result = await sender.sendMutation({
      collection: "todos",
      id: "t1",
      mutationId: "m1",
      operation: "update",
    });
    expect(result).toEqual({
      nack: {code: "conflict", mutationId: "m1", serverSeq: 8},
      type: "nack",
    });
  });

  it("resolves sendMutation via the Socket.io ack callback", async () => {
    server.io.removeAllListeners("connection");
    server.io.on("connection", (socket) => {
      socket.on("sync:mutate", (request: SyncMutateRequest, ack: (response: unknown) => void) => {
        ack({ack: {id: request.id ?? "x", mutationId: request.mutationId, seq: 4}});
      });
    });
    const sender = makeTransport();
    await sender.connect();
    const result = await sender.sendMutation({
      collection: "todos",
      id: "t1",
      mutationId: "m1",
      operation: "update",
    });
    expect(result).toEqual({ack: {id: "t1", mutationId: "m1", seq: 4}, type: "ack"});
  });

  it("resolves sendMutation nacks via the Socket.io ack callback", async () => {
    server.io.removeAllListeners("connection");
    server.io.on("connection", (socket) => {
      socket.on("sync:mutate", (request: SyncMutateRequest, ack: (response: unknown) => void) => {
        ack({nack: {code: "validation", mutationId: request.mutationId}});
      });
    });
    const sender = makeTransport();
    await sender.connect();
    const result = await sender.sendMutation({
      collection: "todos",
      id: "t1",
      mutationId: "m1",
      operation: "update",
    });
    expect(result).toEqual({nack: {code: "validation", mutationId: "m1"}, type: "nack"});
  });

  it("correlates concurrent mutations by mutationId", async () => {
    server.mutateHandler = (request, socket) => {
      // Reply to m1 late so its resolution cannot come from ordering alone.
      const delay = request.mutationId === "m1" ? 40 : 5;
      setTimeout(() => {
        socket.emit("sync:ack", {
          id: request.id ?? "x",
          mutationId: request.mutationId,
          seq: request.mutationId === "m1" ? 1 : 2,
        });
      }, delay);
    };
    const sender = makeTransport();
    await sender.connect();
    const [first, second] = await Promise.all([
      sender.sendMutation({collection: "todos", id: "t1", mutationId: "m1", operation: "update"}),
      sender.sendMutation({collection: "todos", id: "t2", mutationId: "m2", operation: "update"}),
    ]);
    expect(first).toEqual({ack: {id: "t1", mutationId: "m1", seq: 1}, type: "ack"});
    expect(second).toEqual({ack: {id: "t2", mutationId: "m2", seq: 2}, type: "ack"});
  });

  it("rejects sendMutation after the configured timeout", async () => {
    server.mutateHandler = () => {
      // Never reply.
    };
    const sender = makeTransport(50);
    await sender.connect();
    await expect(
      sender.sendMutation({collection: "todos", id: "t1", mutationId: "m1", operation: "update"})
    ).rejects.toThrow("Timed out after 50ms");
  });

  it("rejects in-flight mutations when the transport disconnects", async () => {
    server.mutateHandler = () => {
      // Never reply.
    };
    const sender = makeTransport(5_000);
    await sender.connect();
    const pending = sender.sendMutation({
      collection: "todos",
      id: "t1",
      mutationId: "m1",
      operation: "update",
    });
    // Give the emit a beat to leave, then drop the connection client-side.
    await new Promise((resolve) => setTimeout(resolve, 20));
    sender.disconnect();
    await expect(pending).rejects.toThrow("disconnected");
  });

  it("delivers sync:delta events to listeners with unsubscribe support", async () => {
    const receiver = makeTransport();
    const seen: SyncDelta[] = [];
    const unsubscribe = receiver.onDelta((delta) => seen.push(delta));
    await receiver.connect();

    const delta: SyncDelta = {
      collection: "todos",
      data: {title: "hi"},
      id: "t1",
      method: "create",
      seq: 1,
      stream: "todos|owner:u1",
    };
    server.sockets[0]?.emit("sync:delta", delta);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seen).toEqual([delta]);

    unsubscribe();
    server.sockets[0]?.emit("sync:delta", {...delta, id: "t2"});
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seen).toHaveLength(1);
  });

  it("connect() rejects when the server is unreachable", async () => {
    const dead = createSocketTransport({
      authProvider: {getToken: async () => null},
      baseUrl: "http://127.0.0.1:9",
    });
    await expect(dead.connect()).rejects.toBeDefined();
    dead.disconnect();
  });
});
