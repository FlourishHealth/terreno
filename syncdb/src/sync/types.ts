import type {OutboxOperation} from "../storage/types";

/** A single entity change carried in a server delta. */
export interface DeltaChange<TData = Record<string, unknown>> {
  collection: string;
  entityId: string;
  op: "upsert" | "delete";
  data?: TData;
  version?: string;
  updatedAt?: string;
}

/** Server -> client: ordered batch of changes for a stream at a cursor. */
export interface SyncDeltaEvent {
  type: "sync:delta";
  stream: string;
  cursor: string;
  changes: DeltaChange[];
}

/** Server -> client: a queued mutation was accepted. */
export interface SyncAckEvent {
  type: "sync:ack";
  mutationId: string;
  version?: string;
  cursor?: string;
}

/** Why a mutation was rejected. */
export type SyncNackReason = "conflict" | "validation" | "auth" | "error";

/** Server -> client: a queued mutation was rejected. */
export interface SyncNackEvent {
  type: "sync:nack";
  mutationId: string;
  reason: SyncNackReason;
  serverData?: Record<string, unknown>;
  message?: string;
}

export type SyncServerEvent = SyncDeltaEvent | SyncAckEvent | SyncNackEvent;

/** Client -> server: replay of a local mutation. */
export interface SyncMutationMessage {
  type: "mutation";
  mutationId: string;
  collection: string;
  operation: OutboxOperation;
  entityId?: string;
  args: Record<string, unknown>;
  baseVersion?: string;
}

/** Client -> server: subscribe/resume streams from known cursors. */
export interface SyncSubscribeMessage {
  type: "subscribe";
  streams?: string[];
  cursors?: Record<string, string>;
}

export type SyncClientMessage = SyncMutationMessage | SyncSubscribeMessage;

export type TransportConnectionStatus = "connecting" | "connected" | "disconnected";

/** Pluggable transport so the sync engine is independent of the wire protocol. */
export interface SyncTransport {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  send(message: SyncClientMessage): void;
  onEvent(listener: (event: SyncServerEvent) => void): () => void;
  onStatus(listener: (status: TransportConnectionStatus) => void): () => void;
}
