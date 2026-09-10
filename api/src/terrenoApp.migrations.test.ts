import {beforeEach, describe, expect, it} from "bun:test";
import {join} from "node:path";
import mongoose from "mongoose";
import type {UserModel as UserModelType} from "./auth";
import {runStartupMigrations} from "./migrations/startup";
import {MIGRATION_LOCK_ID, MIGRATIONS_COLLECTION} from "./migrations/types";
import {TerrenoApp} from "./terrenoApp";
import {setupDb, UserModel} from "./tests";

const fixtures = (...parts: string[]): string => {
  return join(import.meta.dir, "migrations", "fixtures", ...parts);
};

const appliedIds = async (): Promise<string[]> => {
  const docs = await mongoose.connection
    .collection(MIGRATIONS_COLLECTION)
    .find({_id: {$ne: MIGRATION_LOCK_ID}})
    .project({id: 1})
    .toArray();
  return docs.map((doc) => String(doc.id)).sort();
};

describe("runStartupMigrations", () => {
  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
  });

  it("does not run when migrations option is omitted", async () => {
    const result = await runStartupMigrations({
      env: {NODE_ENV: "test"},
      mongoose,
    });
    expect(result.ran).toBe(false);
    expect(await appliedIds()).toEqual([]);
  });

  it("does not run when runOnStart is omitted", async () => {
    const result = await runStartupMigrations({
      env: {NODE_ENV: "test"},
      migrations: {dir: fixtures("valid")},
      mongoose,
    });
    expect(result.ran).toBe(false);
    expect(await appliedIds()).toEqual([]);
  });

  it("applies pending files when runOnStart is true", async () => {
    const result = await runStartupMigrations({
      env: {NODE_ENV: "test"},
      migrations: {dir: fixtures("valid"), runOnStart: true},
      mongoose,
    });
    expect(result.ran).toBe(true);
    expect(result.applied).toEqual(["20260910120000-alpha", "20260910120001-beta"]);
    expect(await appliedIds()).toEqual(["20260910120000-alpha", "20260910120001-beta"]);
  });

  it("throws in production without ALLOW_MIGRATIONS before applying", async () => {
    await expect(
      runStartupMigrations({
        env: {NODE_ENV: "production"},
        migrations: {dir: fixtures("valid"), runOnStart: true},
        mongoose,
      })
    ).rejects.toThrow("Migrations not allowed");
    expect(await appliedIds()).toEqual([]);
  });
});

describe("TerrenoApp start migrations", () => {
  const typedUserModel = UserModel as unknown as UserModelType;

  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
  });

  it("applies pending files through start() when runOnStart is true", async () => {
    const app = new TerrenoApp({
      migrations: {dir: fixtures("valid"), runOnStart: true},
      skipListen: true,
      userModel: typedUserModel,
    });
    app.start();
    await app.whenReady();
    expect(await appliedIds()).toEqual(["20260910120000-alpha", "20260910120001-beta"]);
  });

  it("rejects whenReady in production without ALLOW_MIGRATIONS and does not listen", async () => {
    process.env.NODE_ENV = "production";
    Reflect.deleteProperty(process.env, "ALLOW_MIGRATIONS");
    const app = new TerrenoApp({
      migrations: {dir: fixtures("valid"), runOnStart: true},
      skipListen: true,
      userModel: typedUserModel,
    });
    app.start();
    await expect(app.whenReady()).rejects.toThrow("Migrations not allowed");
    expect(await appliedIds()).toEqual([]);
  });
});
