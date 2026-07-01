import type {
  SyncClientMessage,
  SyncServerEvent,
  SyncTransport,
  TransportConnectionStatus,
} from "./types";

export interface FakeTransport extends SyncTransport {
  /** Messages the client has sent, in order. */
  readonly sent: SyncClientMessage[];
  /** Simulate a server event reaching the client. */
  emit(event: SyncServerEvent): void;
  /** Simulate a connection status change. */
  setStatus(status: TransportConnectionStatus): void;
}

/**
 * In-memory transport for tests and local development. Records sent messages and
 * lets tests drive inbound server events and connection status deterministically.
 */
export const createFakeTransport = (): FakeTransport => {
  const sent: SyncClientMessage[] = [];
  const eventListeners = new Set<(event: SyncServerEvent) => void>();
  const statusListeners = new Set<(status: TransportConnectionStatus) => void>();
  let connected = false;

  const setStatus = (status: TransportConnectionStatus): void => {
    connected = status === "connected";
    for (const listener of statusListeners) {
      listener(status);
    }
  };

  return {
    connect: async (): Promise<void> => {
      setStatus("connected");
    },
    disconnect: (): void => {
      setStatus("disconnected");
    },
    emit: (event: SyncServerEvent): void => {
      for (const listener of eventListeners) {
        listener(event);
      }
    },
    isConnected: (): boolean => connected,
    onEvent: (listener: (event: SyncServerEvent) => void): (() => void) => {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    onStatus: (listener: (status: TransportConnectionStatus) => void): (() => void) => {
      statusListeners.add(listener);
      return () => {
        statusListeners.delete(listener);
      };
    },
    send: (message: SyncClientMessage): void => {
      sent.push(message);
    },
    sent,
    setStatus,
  };
};
