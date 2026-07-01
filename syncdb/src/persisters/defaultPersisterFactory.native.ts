import {openDatabaseSync} from "expo-sqlite";
import type {MergeableStore} from "tinybase";
import {createExpoSqlitePersister} from "tinybase/persisters/persister-expo-sqlite";

import {adaptPersister} from "./adapt";
import type {DefaultPersisterOptions, SyncDbPersister, SyncDbPersisterFactory} from "./types";

/**
 * Native default persister: stores the (mergeable) TinyBase content in an
 * expo-sqlite database using JSON serialization, per the Expo local-first
 * guide's iOS/Android recommendation.
 */
export const createDefaultPersisterFactory = ({
  databaseName = "terreno-syncdb.db",
  storeTableName = "terreno_syncdb",
}: DefaultPersisterOptions = {}): SyncDbPersisterFactory => {
  return (store: MergeableStore): SyncDbPersister => {
    const db = openDatabaseSync(databaseName);
    return adaptPersister(createExpoSqlitePersister(store, db, storeTableName));
  };
};
