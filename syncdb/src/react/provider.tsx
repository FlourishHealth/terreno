import React, {createContext, useContext} from "react";

import type {SyncDbClient} from "../client";

const SyncDbContext = createContext<SyncDbClient | null>(null);

export interface SyncDbProviderProps {
  client: SyncDbClient;
  children: React.ReactNode;
}

/** Provides a SyncDbClient to descendant hooks. */
export const SyncDbProvider: React.FC<SyncDbProviderProps> = ({client, children}) => {
  return <SyncDbContext.Provider value={client}>{children}</SyncDbContext.Provider>;
};

/** Access the SyncDbClient from context (throws if no provider is mounted). */
export const useSyncDbClient = (): SyncDbClient => {
  const client = useContext(SyncDbContext);
  if (!client) {
    throw new Error("useSyncDbClient must be used within a SyncDbProvider");
  }
  return client;
};
