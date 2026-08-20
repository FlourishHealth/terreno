/**
 * Isolated test (own `bun test` invocation via scripts/check-coverage.ts):
 * `mock.module` replaces the expo-sqlite native module and TinyBase's
 * expo-sqlite persister module globally for the process (the latter imports
 * expo-sqlite at its top level, which cannot load outside React Native), so
 * this must not share a test pass with the rest of the suite.
 */
import {describe, expect, it, mock} from "bun:test";

const fakeDb = {fake: true};
const fakePersister = {marker: "fake-persister"};
const openDatabaseSync = mock((_databaseName: string) => fakeDb);
const createExpoSqlitePersister = mock(
  (_store: unknown, _db: unknown, _tableName: string) => fakePersister
);

mock.module("expo-sqlite", () => ({openDatabaseSync}));
mock.module("tinybase/persisters/persister-expo-sqlite", () => ({createExpoSqlitePersister}));

import {createDefaultPersisterFactory} from "../persisters/defaultPersisterFactory.native";
import {createSyncStore} from "../storage/store";

describe("createDefaultPersisterFactory (native)", () => {
  it("opens the expo-sqlite database lazily and wires the JSON-mode persister", () => {
    const factory = createDefaultPersisterFactory();
    // Nothing touches expo-sqlite until a persister is actually created.
    expect(openDatabaseSync).not.toHaveBeenCalled();

    const store = createSyncStore({collections: ["todos"]});
    const persister = factory({databaseName: "terreno-syncdb.db", store: store.raw});
    expect(openDatabaseSync).toHaveBeenCalledWith("terreno-syncdb.db");
    // JSON serialization mode: the third argument is a string table name
    // (tabular config objects cannot persist MergeableStore CRDT metadata).
    expect(createExpoSqlitePersister).toHaveBeenCalledWith(store.raw, fakeDb, "terreno_syncdb");
    expect(persister).toBe(fakePersister as unknown as ReturnType<typeof factory>);
  });

  it("honors a custom storeTableName", () => {
    const factory = createDefaultPersisterFactory({storeTableName: "custom_table"});
    const store = createSyncStore({collections: ["todos"]});
    factory({databaseName: "custom.db", store: store.raw});
    expect(openDatabaseSync).toHaveBeenCalledWith("custom.db");
    expect(createExpoSqlitePersister).toHaveBeenCalledWith(store.raw, fakeDb, "custom_table");
  });
});
