import {io, type Socket} from "socket.io-client";

import type {AuthProvider, SyncAck, SyncDelta, SyncMutateRequest, SyncNack} from "../types";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  type SendMutationResult,
  type SyncTransport,
  type TransportStatus,
} from "./transport";

export interface SocketTransportConfig {
  /** Server origin, e.g. "http://localhost:4000". */
  baseUrl: string;
  /** Token source; `getToken()` is called fresh on every connection attempt. */
  authProvider: Pick<AuthProvider, "getToken">;
  /** How long to wait for a mutation ack/nack before rejecting (default 15s). */
  timeoutMs?: number;
}

interface PendingMutation {
  resolve: (result: SendMutationResult) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Socket.io implementation of {@link SyncTransport}, speaking the server's
 * sync protocol (see @terreno/api `src/sync/socketHandlers.ts`):
 *
 * - client emits `sync:subscribe {collections}` and `sync:mutate <request>`;
 * - server replies with `sync:ack` / `sync:nack` events **and** a Socket.io
 *   ack callback carrying `{ack}` / `{nack}` — replies are correlated by
 *   `mutationId` and the first to arrive settles the pending promise;
 * - server pushes `sync:delta` events for subscribed streams.
 *
 * The handshake token is resolved via `authProvider.getToken()` inside the
 * Socket.io `auth` callback, which runs on **every** connection attempt — the
 * token is never cached, so session refreshes are picked up transparently on
 * reconnect. The raw provider token is sent with a `Bearer ` prefix (unless the
 * provider already included one): the server's legacy JWT socket validator
 * (`@thream/socketio-jwt` via @terreno/api `createSocketAuthMiddleware`)
 * requires that exact format, and the Better Auth validator strips an optional
 * prefix — so prefixing is correct for both. Reconnection is enabled; on every
 * (re)connect the transport re-emits `sync:subscribe` for all previously
 * subscribed collections because server-side subscription state is
 * per-connection.
 */
export const createSocketTransport = ({
  baseUrl,
  authProvider,
  timeoutMs = DEFAULT_MUTATION_TIMEOUT_MS,
}: SocketTransportConfig): SyncTransport => {
  const deltaListeners = new Set<(delta: SyncDelta) => void>();
  const statusListeners = new Set<(status: TransportStatus) => void>();
  const pending = new Map<string, PendingMutation>();
  const subscribed = new Set<string>();

  const socket: Socket = io(baseUrl, {
    auth: (callback) => {
      // Called per connection attempt; never cache the token across attempts.
      // The server's socket auth chain expects "Bearer <token>" (matching the
      // Authorization header format the HTTP channel sends).
      void authProvider.getToken().then(
        (token) =>
          callback(token ? {token: token.startsWith("Bearer ") ? token : `Bearer ${token}`} : {}),
        () => callback({})
      );
    },
    autoConnect: false,
    reconnection: true,
    // Start with polling so dev server restarts don't fail the initial
    // websocket-only handshake; Socket.io upgrades once connected.
    transports: ["polling", "websocket"],
  });

  const settle = (mutationId: string, result: SendMutationResult): void => {
    const entry = pending.get(mutationId);
    if (!entry) {
      return;
    }
    pending.delete(mutationId);
    clearTimeout(entry.timer);
    entry.resolve(result);
  };

  const rejectAllPending = (reason: string): void => {
    for (const [mutationId, entry] of pending) {
      pending.delete(mutationId);
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
  };

  const notifyStatus = (connected: boolean): void => {
    for (const listener of statusListeners) {
      listener({connected});
    }
  };

  socket.on("sync:delta", (delta: SyncDelta) => {
    for (const listener of deltaListeners) {
      listener(delta);
    }
  });
  socket.on("sync:ack", (ack: SyncAck) => {
    settle(ack.mutationId, {ack, type: "ack"});
  });
  socket.on("sync:nack", (nack: SyncNack) => {
    settle(nack.mutationId, {nack, type: "nack"});
  });
  socket.on("connect", () => {
    // Server-side subscriptions are per-connection: re-subscribe on reconnect.
    if (subscribed.size > 0) {
      socket.emit("sync:subscribe", {collections: [...subscribed]});
    }
    notifyStatus(true);
  });
  socket.on("disconnect", () => {
    // Replies for in-flight mutations will never arrive on this connection;
    // reject now so the replay coordinator can requeue instead of waiting out
    // the full timeout.
    rejectAllPending("Socket disconnected before the mutation was acknowledged");
    notifyStatus(false);
  });

  const connect = (): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (socket.connected) {
        resolve();
        return;
      }
      const cleanup = (): void => {
        socket.off("connect", onConnect);
        socket.off("connect_error", onConnectError);
      };
      const onConnect = (): void => {
        cleanup();
        resolve();
      };
      const onConnectError = (error: Error): void => {
        // Reject the initial connect() promise; background reconnection keeps
        // retrying and a later success surfaces through onStatusChange.
        cleanup();
        reject(error);
      };
      socket.once("connect", onConnect);
      socket.once("connect_error", onConnectError);
      socket.connect();
    });

  const disconnect = (): void => {
    socket.disconnect();
    rejectAllPending("Transport disconnected");
  };

  const subscribe = (collections: string[]): void => {
    for (const collection of collections) {
      subscribed.add(collection);
    }
    // Only emit when connected; the connect handler (re)subscribes otherwise —
    // Socket.io would buffer a disconnected emit and duplicate the subscribe.
    if (socket.connected && collections.length > 0) {
      socket.emit("sync:subscribe", {collections});
    }
  };

  const sendMutation = (request: SyncMutateRequest): Promise<SendMutationResult> =>
    new Promise<SendMutationResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(request.mutationId);
        reject(
          new Error(`Timed out after ${timeoutMs}ms waiting for ack/nack: ${request.mutationId}`)
        );
      }, timeoutMs);
      pending.set(request.mutationId, {reject, resolve, timer});
      // The server both emits sync:ack/sync:nack and invokes this Socket.io
      // ack callback; whichever arrives first settles (settle is idempotent).
      socket.emit("sync:mutate", request, (response: {ack?: SyncAck; nack?: SyncNack}) => {
        if (response?.ack) {
          settle(request.mutationId, {ack: response.ack, type: "ack"});
        } else if (response?.nack) {
          settle(request.mutationId, {nack: response.nack, type: "nack"});
        }
      });
    });

  return {
    connect,
    disconnect,
    onDelta: (callback: (delta: SyncDelta) => void): (() => void) => {
      deltaListeners.add(callback);
      return () => {
        deltaListeners.delete(callback);
      };
    },
    onStatusChange: (callback: (status: TransportStatus) => void): (() => void) => {
      statusListeners.add(callback);
      return () => {
        statusListeners.delete(callback);
      };
    },
    sendMutation,
    subscribe,
  };
};
