import {
  createSyncDbClient,
  type SyncClientMessage,
  type SyncDbClient,
  type SyncServerEvent,
  type SyncTransport,
  type TransportConnectionStatus,
} from "@terreno/syncdb";

/**
 * Feature flag controlling whether the todos screen uses the local-first
 * `@terreno/syncdb` path instead of the legacy RTK Query path. Enable with
 * `EXPO_PUBLIC_USE_SYNCDB=true`.
 */
export const USE_SYNCDB = process.env.EXPO_PUBLIC_USE_SYNCDB === "true";

const ACK_DELAY_MS = 150;

/**
 * In-app simulated "server" transport. The example backend does not yet expose
 * the sync delta protocol, so this acks every replayed mutation while connected
 * to demonstrate the offline -> online replay/queue-drain flow locally.
 */
const createSimulatedTransport = (): SyncTransport => {
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
      if (message.type !== "mutation" || !connected) {
        return;
      }
      setTimeout(() => {
        for (const listener of eventListeners) {
          listener({mutationId: message.mutationId, type: "sync:ack"});
        }
      }, ACK_DELAY_MS);
    },
  };
};

let client: SyncDbClient | undefined;

/** Lazily create the singleton syncdb client used by the example app. */
export const getSyncDbClient = (): SyncDbClient => {
  if (!client) {
    client = createSyncDbClient({
      databaseName: "terreno-example-syncdb",
      transport: createSimulatedTransport(),
    });
  }
  return client;
};
