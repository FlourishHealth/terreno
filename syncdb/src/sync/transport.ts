import type {SyncAck, SyncDelta, SyncMutateRequest, SyncNack} from "../types";

/** Default time to wait for a mutation ack/nack before rejecting. */
export const DEFAULT_MUTATION_TIMEOUT_MS = 15_000;

/** The server's reply to a sent mutation: accepted (ack) or rejected (nack). */
export type SendMutationResult = {type: "ack"; ack: SyncAck} | {type: "nack"; nack: SyncNack};

/** Transport connection status snapshot delivered to status listeners. */
export interface TransportStatus {
  connected: boolean;
}

/**
 * Bidirectional sync channel between the local store and the server. The
 * Socket.io implementation (`createSocketTransport`) speaks the server's
 * `sync:*` event protocol; `createFakeTransport` provides a deterministic
 * in-memory double for tests.
 */
export interface SyncTransport {
  /** Open the connection; resolves once connected, rejects on the first failure. */
  connect: () => Promise<void>;
  /** Close the connection and reject any in-flight mutation sends. */
  disconnect: () => void;
  /** Subscribe to delta streams for the given collections (idempotent server-side). */
  subscribe: (collections: string[]) => void;
  /**
   * Send a mutation and resolve with the server's ack/nack, correlated by
   * `mutationId`. Rejects when no reply arrives within the transport's
   * configured timeout (default {@link DEFAULT_MUTATION_TIMEOUT_MS}) or when
   * the connection drops before the reply.
   */
  sendMutation: (request: SyncMutateRequest) => Promise<SendMutationResult>;
  /** Subscribe to inbound `sync:delta` events. Returns an unsubscribe function. */
  onDelta: (callback: (delta: SyncDelta) => void) => () => void;
  /** Subscribe to connection status changes. Returns an unsubscribe function. */
  onStatusChange: (callback: (status: TransportStatus) => void) => () => void;
}
