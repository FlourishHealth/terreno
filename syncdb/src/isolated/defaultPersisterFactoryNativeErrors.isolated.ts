/**
 * Isolated: mock expo-sqlite as missing or incomplete so loadExpoSqlite error
 * paths do not leak into the rest of the suite.
 */
import {describe, expect, it, mock} from "bun:test";

mock.module("expo-sqlite", () => ({}));
mock.module("tinybase/persisters/persister-expo-sqlite", () => ({
  createExpoSqlitePersister: () => ({}),
}));

import {createDefaultPersisterFactory} from "../persisters/defaultPersisterFactory.native";
import {createSyncStore} from "../storage/store";

describe("createDefaultPersisterFactory (native errors)", () => {
  it("throws when expo-sqlite has no openDatabaseSync", () => {
    const factory = createDefaultPersisterFactory();
    const store = createSyncStore({collections: ["todos"]});
    expect(() => factory({databaseName: "terreno-syncdb.db", store: store.raw})).toThrow(
      /expo-sqlite peer/
    );
  });
});
