import {describe, expect, it} from "bun:test";
import {mkdirSync, mkdtempSync, utimesSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import mongoose from "mongoose";

import {createMongoTestCache} from "./mongoTestCache";

const CacheWidget =
  mongoose.models.CacheCoverageWidget ??
  mongoose.model(
    "CacheCoverageWidget",
    new mongoose.Schema({name: String}, {collection: "cache_coverage_widgets"})
  );

describe("createMongoTestCache", () => {
  it("writes, loads, and cleans a cache directory", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "terreno-mongo-cache-"));
    const sourceDir = mkdtempSync(join(tmpdir(), "terreno-mongo-src-"));
    writeFileSync(join(sourceDir, "model.ts"), "export const n = 1;\n");
    mkdirSync(join(sourceDir, "nested"));
    writeFileSync(join(sourceDir, "nested", "child.ts"), "export const c = 2;\n");

    const cache = createMongoTestCache({
      cacheDir,
      createTestData: async () => {
        await CacheWidget.deleteMany({});
        await CacheWidget.create({name: "cached"});
        return {
          nested: [{id: "507f1f77bcf86cd799439011"}],
          ok: true,
          when: "2020-01-02T03:04:05.000Z",
        };
      },
      sourceDirs: [sourceDir, join(sourceDir, "missing-dir")],
    });

    expect(cache.cacheFilesExist()).toBe(false);
    await cache.setupTestCache({force: true});
    expect(cache.cacheFilesExist()).toBe(true);
    await CacheWidget.deleteMany({});
    await cache.loadTestDataFromCache();
    const restored = await CacheWidget.find({name: "cached"});
    expect(restored.length).toBeGreaterThan(0);
    await cache.setupTestCache();
    cache.cleanCache();
    expect(cache.cacheFilesExist()).toBe(false);
  });

  it("treats expired cache files as missing outside CI", () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "terreno-mongo-cache-old-"));
    writeFileSync(join(cacheDir, "cached-data.json"), "{}");
    writeFileSync(join(cacheDir, "cached-collections.json"), "{}");
    writeFileSync(join(cacheDir, "source-hash.txt"), "abc");
    const old = new Date("2020-01-01T00:00:00.000Z");
    utimesSync(join(cacheDir, "cached-data.json"), old, old);
    const previousCi = process.env.CI;
    delete process.env.CI;
    try {
      const cache = createMongoTestCache({
        cacheDir,
        createTestData: async () => ({}),
        sourceDirs: [],
      });
      expect(cache.cacheFilesExist()).toBe(false);
    } finally {
      if (previousCi === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previousCi;
      }
    }
  });

  it("rebuilds from source when the cache is missing and restores typed values", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "terreno-mongo-cache-load-"));
    const sourceDir = mkdtempSync(join(tmpdir(), "terreno-mongo-src-load-"));
    writeFileSync(join(sourceDir, "model.ts"), "export const n = 2;\n");
    const cache = createMongoTestCache({
      cacheDir,
      createTestData: async () => {
        await CacheWidget.deleteMany({});
        const db = mongoose.connection.db;
        if (!db) {
          throw new Error("mongoose is not connected");
        }
        await db.collection("cache_coverage_widgets").insertOne({
          flag: true,
          name: "typed",
          nested: [{id: "507f1f77bcf86cd799439011", n: null}],
          tags: ["a"],
          when: "2020-01-02T03:04:05.000Z",
        });
        return {ok: true};
      },
      sourceDirs: [sourceDir],
    });
    await cache.loadTestDataFromCache();
    const restored = await CacheWidget.find({name: "typed"});
    expect(restored.length).toBeGreaterThan(0);
    cache.cleanCache();
  });
});
