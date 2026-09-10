import {describe, it} from "bun:test";
import {
  checkMigrationFiles,
  exerciseReversibleMigrations,
  MIGRATIONS_COLLECTION,
  runSeeds,
} from "@terreno/api";
import {assert} from "chai";
import mongoose from "mongoose";
import supertest from "supertest";
import {EXAMPLE_MIGRATIONS_DIR} from "./migrationsDir";
import {seedSteps} from "./scripts/seed-test-data";
import {start} from "./server";

const expectedId = "20260910120000-todos-title-owner-index";

describe("example-backend migrations", () => {
  it("loads timestamped files from migrations/", async () => {
    const loaded = await checkMigrationFiles({dir: EXAMPLE_MIGRATIONS_DIR});
    assert.deepEqual(
      loaded.map((migration) => migration.id),
      [expectedId]
    );
    assert.isFunction(loaded[0]?.down);
  });

  it("applies and reverses the example todos index", async () => {
    const result = await exerciseReversibleMigrations({
      connect: async () => mongoose.connection,
      dir: EXAMPLE_MIGRATIONS_DIR,
    });
    assert.deepEqual(result.applied, [expectedId]);
    assert.deepEqual(result.reversed, [expectedId]);
    assert.isNull(result.skippedIrreversible);
  });

  it("does not wipe terreno_migrations on seed reset", async () => {
    await mongoose.connection.collection(MIGRATIONS_COLLECTION).insertOne({
      _id: "keep-me",
      appliedAt: new Date(),
      checksum: "abc",
      id: "keep-me",
    });

    await runSeeds({mode: "reset", name: "example-backend", steps: seedSteps});

    const kept = await mongoose.connection
      .collection(MIGRATIONS_COLLECTION)
      .findOne({_id: "keep-me"});
    assert.exists(kept);
  });

  it("mounts admin migrations on the example server", async () => {
    const app = await start(true);
    await supertest(app).get("/admin/migrations").expect(401);
  });
});
