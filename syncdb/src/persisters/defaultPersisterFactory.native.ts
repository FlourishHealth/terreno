import type {DefaultPersisterFactoryConfig, PersisterFactory} from "./types";

const DEFAULT_STORE_TABLE_NAME = "terreno_syncdb";

/**
 * Native default persister: the MergeableStore is stored in an expo-sqlite
 * database using TinyBase's JSON serialization mode (a string table name —
 * required, since tabular mode cannot carry MergeableStore CRDT metadata).
 * SQLite files are already sandboxed per app on iOS/Android, so no additional
 * encryption layer is applied here.
 */
export const createDefaultPersisterFactory = (
  config: DefaultPersisterFactoryConfig = {}
): PersisterFactory => {
  return ({store, databaseName}) => {
    // Lazy requires: TinyBase's expo-sqlite persister module itself imports
    // expo-sqlite at its top level, so deferring BOTH loads until a persister
    // is actually created keeps @terreno/syncdb importable in apps (and test
    // runtimes) that do not have the optional expo-sqlite peer installed.
    const {openDatabaseSync} = require("expo-sqlite") as typeof import("expo-sqlite");
    const {createExpoSqlitePersister} =
      require("tinybase/persisters/persister-expo-sqlite") as typeof import("tinybase/persisters/persister-expo-sqlite");
    const db = openDatabaseSync(databaseName);
    return createExpoSqlitePersister(store, db, config.storeTableName ?? DEFAULT_STORE_TABLE_NAME);
  };
};
