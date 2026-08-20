import {describe, expect, it} from "bun:test";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {discoverCollections} from "./discoverCollections";
import {generateSyncDbSdk} from "./generate";
import {friendlyHookNames} from "./hookNames";
import {loadSpec} from "./loadSpec";

const fixturePath = join(import.meta.dir, "fixtures", "openapi.example.json");

describe("friendlyHookNames", () => {
  it("uses entity-centric names for todos", () => {
    expect(friendlyHookNames({collection: "todos", entityName: "Todo"})).toEqual({
      create: "useCreateTodo",
      list: "useTodos",
      read: "useTodo",
      remove: "useDeleteTodo",
      update: "useUpdateTodo",
    });
  });
});

describe("discoverCollections", () => {
  it("reads x-terreno-sync from the fixture spec", async () => {
    const spec = await loadSpec(fixturePath);
    const discovered = discoverCollections({spec});
    expect(discovered.map((entry) => entry.collection)).toEqual(["todos"]);
    expect(discovered[0]?.entityName).toBe("Todo");
    expect(discovered[0]?.createName).toBe("CreateTodoBody");
    expect(discovered[0]?.updateName).toBe("UpdateTodoBody");
  });

  it("filters with --collections", async () => {
    const spec = await loadSpec(fixturePath);
    expect(() => discoverCollections({collections: ["notes"], spec})).toThrow(/matched/);
  });

  it("errors when the spec has no extensions and no --collections", () => {
    expect(() => discoverCollections({spec: {paths: {"/health": {get: {}}}}})).toThrow(
      /No synced collections found/
    );
  });
});

describe("generateSyncDbSdk", () => {
  it("emits SYNC_COLLECTIONS and friendly hooks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "syncdb-codegen-"));
    const out = join(dir, "syncDbSdk.ts");
    try {
      const source = await generateSyncDbSdk({
        format: false,
        out,
        schema: fixturePath,
      });
      expect(source).toContain('export const SYNC_COLLECTIONS = ["todos"] as const;');
      expect(source).toContain("useListQuery: useTodos");
      expect(source).toContain("useReadQuery: useTodo");
      expect(source).toContain("useCreateMutation: useCreateTodo");
      expect(source).toContain("useUpdateMutation: useUpdateTodo");
      expect(source).toContain("useDeleteMutation: useDeleteTodo");
      expect(source).toContain("export interface Todo");
      expect(await readFile(out, "utf8")).toBe(source);
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });

  it("applies retries: false from config overrides", async () => {
    const dir = await mkdtemp(join(tmpdir(), "syncdb-codegen-"));
    const out = join(dir, "syncDbSdk.ts");
    try {
      const source = await generateSyncDbSdk({
        config: {overrides: {todos: {retries: false}}},
        format: false,
        out,
        schema: fixturePath,
      });
      expect(source).toContain(
        'createCollectionHooks<Todo, CreateTodoBody, UpdateTodoBody>({collection: "todos", retries: false})'
      );
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });
});
