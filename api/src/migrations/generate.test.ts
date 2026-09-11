import {describe, expect, it} from "bun:test";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {generateMigration} from "./generate";
import {checkMigrationFiles} from "./load";

const register = (name: string, schema: mongoose.Schema): mongoose.Model<mongoose.Document> => {
  if (mongoose.models[name]) {
    mongoose.deleteModel(name);
  }
  return mongoose.model(name, schema);
};

const makeModels = ({
  notes,
  requiredTitle,
}: {
  notes?: boolean;
  requiredTitle?: boolean;
}): mongoose.Model<mongoose.Document>[] => {
  const schema = new mongoose.Schema(
    {
      title: {description: "Title", required: requiredTitle !== false, type: String},
      ...(notes ? {notes: {description: "Notes", type: String}} : {}),
    },
    {collection: "gen_todos"}
  );
  schema.index({title: 1});
  return [register("GenTodo", schema)];
};

describe("generateMigration", () => {
  it("writes the first file from an empty snapshot", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrate-gen-"));
    try {
      const result = await generateMigration({
        dir,
        models: makeModels({notes: true}),
        name: "init",
        now: () => DateTime.fromISO("2026-09-10T12:00:00.000Z"),
      });
      expect(result.noop).toBe(false);
      expect(result.path).toContain("20260910120000-init.ts");
      const source = await readFile(result.path as string, "utf8");
      expect(source).toContain("schemaAfter");
      expect(source).toContain("gen_todos");
      const loaded = await checkMigrationFiles({dir});
      expect(loaded).toHaveLength(1);
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });

  it("exits as a no-op when the catalog matches the last schemaAfter", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrate-gen-"));
    try {
      const models = makeModels({notes: true});
      await generateMigration({
        dir,
        models,
        name: "init",
        now: () => DateTime.fromISO("2026-09-10T12:00:00.000Z"),
      });
      const second = await generateMigration({
        dir,
        models,
        name: "again",
        now: () => DateTime.fromISO("2026-09-10T12:01:00.000Z"),
      });
      expect(second.noop).toBe(true);
      expect(second.path).toBeNull();
      expect(await checkMigrationFiles({dir})).toHaveLength(1);
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });

  it("emits a required-field stub that throws in dry-run and wet", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrate-gen-"));
    try {
      const firstModels = makeModels({notes: false, requiredTitle: false});
      await generateMigration({
        dir,
        models: firstModels,
        name: "base",
        now: () => DateTime.fromISO("2026-09-10T12:00:00.000Z"),
      });
      const required = new mongoose.Schema(
        {
          title: {description: "Title", required: true, type: String},
        },
        {collection: "gen_todos"}
      );
      required.index({title: 1});
      const result = await generateMigration({
        dir,
        models: [register("GenTodo", required)],
        name: "require-title",
        now: () => DateTime.fromISO("2026-09-10T12:02:00.000Z"),
      });
      expect(result.noop).toBe(false);
      const loaded = await checkMigrationFiles({dir});
      const stub = loaded[loaded.length - 1];
      await expect(
        stub.up({
          dryRun: true,
          logger: {
            debug: () => undefined,
            error: () => undefined,
            info: () => undefined,
            warn: () => undefined,
          },
          mongoose,
        })
      ).rejects.toThrow("Unsafe");
      await expect(
        stub.up({
          dryRun: false,
          logger: {
            debug: () => undefined,
            error: () => undefined,
            info: () => undefined,
            warn: () => undefined,
          },
          mongoose,
        })
      ).rejects.toThrow("Unsafe");
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });

  it("skips createIndex when a generated safe up runs with dryRun", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrate-gen-"));
    try {
      const schema = new mongoose.Schema(
        {title: {description: "Title", type: String}},
        {collection: "gen_todos"}
      );
      await generateMigration({
        dir,
        models: [register("GenTodo", schema)],
        name: "base",
        now: () => DateTime.fromISO("2026-09-10T12:00:00.000Z"),
      });
      const indexed = new mongoose.Schema(
        {title: {description: "Title", type: String}},
        {collection: "gen_todos"}
      );
      indexed.index({title: 1});
      const result = await generateMigration({
        dir,
        models: [register("GenTodo", indexed)],
        name: "title-index",
        now: () => DateTime.fromISO("2026-09-10T12:03:00.000Z"),
      });
      expect(result.noop).toBe(false);
      const source = await readFile(result.path as string, "utf8");
      expect(source).toContain("if (ctx.dryRun)");
      expect(source).toContain("createIndex");
      const loaded = await checkMigrationFiles({dir});
      const generated = loaded[loaded.length - 1];
      await generated.up({
        dryRun: true,
        logger: {
          debug: () => undefined,
          error: () => undefined,
          info: () => undefined,
          warn: () => undefined,
        },
        mongoose,
      });
      expect(source).toContain("dropIndex");
      expect(source).toContain("title_1");
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });

  it("fails closed when generate is called with no models", async () => {
    const dir = await mkdtemp(join(tmpdir(), "migrate-gen-"));
    try {
      await generateMigration({
        dir,
        models: makeModels({notes: true}),
        name: "init",
        now: () => DateTime.fromISO("2026-09-10T12:00:00.000Z"),
      });
      await expect(
        generateMigration({
          dir,
          models: [],
          name: "oops",
          now: () => DateTime.fromISO("2026-09-10T12:04:00.000Z"),
        })
      ).rejects.toThrow("No Mongoose models found");
      expect(await checkMigrationFiles({dir})).toHaveLength(1);
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });
});
