import {beforeEach, describe, expect, it} from "bun:test";
import {join} from "node:path";
import mongoose from "mongoose";

import {setupDb} from "../tests";
import {exerciseReversibleMigrations} from "./exercise";
import {MIGRATION_LOCK_ID, MIGRATIONS_COLLECTION} from "./types";

const fixtures = (...parts: string[]): string => {
  return join(import.meta.dir, "fixtures", ...parts);
};

const appliedIds = async (): Promise<string[]> => {
  const docs = await mongoose.connection
    .collection(MIGRATIONS_COLLECTION)
    .find({_id: {$ne: MIGRATION_LOCK_ID}})
    .project({id: 1})
    .toArray();
  return docs.map((doc) => String(doc.id)).sort();
};

describe("exerciseReversibleMigrations", () => {
  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
  });

  it("applies all files then rolls back until an irreversible file stops the chain", async () => {
    const result = await exerciseReversibleMigrations({
      connect: async () => mongoose.connection,
      dir: fixtures("valid"),
    });

    expect(result.applied).toEqual(["20260910120000-alpha", "20260910120001-beta"]);
    expect(result.reversed).toEqual(["20260910120001-beta"]);
    expect(result.skippedIrreversible).toBe("20260910120000-alpha");
    expect(await appliedIds()).toEqual(["20260910120000-alpha"]);
  });

  it("reverses every file when all have down", async () => {
    const result = await exerciseReversibleMigrations({
      connect: async () => mongoose.connection,
      dir: fixtures("all-down"),
    });

    expect(result.applied).toEqual(["20260910120000-one", "20260910120001-two"]);
    expect(result.reversed).toEqual(["20260910120001-two", "20260910120000-one"]);
    expect(result.skippedIrreversible).toBeNull();
    expect(await appliedIds()).toEqual([]);
  });
});
