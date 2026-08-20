import {describe, expect, it} from "bun:test";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

import {discoverCollections} from "./discoverCollections";
import {emitSdk} from "./emitSdk";
import {loadSpec} from "./loadSpec";
import type {OpenApiDocument} from "./types";

const fixturePath = join(import.meta.dir, "fixtures", "openapi.example.json");

describe("discoverCollections", () => {
  it("discovers collections from x-terreno-sync extensions", async () => {
    const doc = await loadSpec(fixturePath);
    const collections = discoverCollections({doc});
    expect(collections).toEqual([
      {
        collection: "todos",
        createSchemaName: "CreateTodo",
        entitySchemaName: "Todo",
        listPath: "/todos",
        scope: "owner",
        updateSchemaName: "UpdateTodo",
      },
    ]);
  });

  it("errors when no collections can be resolved", () => {
    const doc: OpenApiDocument = {openapi: "3.0.0", paths: {}};
    expect(() => discoverCollections({doc})).toThrow(/No synced collections found/);
  });

  it("applies retries overrides from config", async () => {
    const doc = await loadSpec(fixturePath);
    const collections = discoverCollections({
      config: {overrides: {todos: {retries: false}}},
      doc,
    });
    expect(collections[0]?.retries).toBe(false);
  });
});

describe("emitSdk", () => {
  it("emits friendly hook names and SYNC_COLLECTIONS", async () => {
    const doc = await loadSpec(fixturePath);
    const collections = discoverCollections({doc});
    const output = emitSdk({collections, doc});

    expect(output).toContain('export const SYNC_COLLECTIONS = ["todos"] as const;');
    expect(output).toContain("useListQuery: useTodos");
    expect(output).toContain("useReadQuery: useTodo");
    expect(output).toContain("useCreateMutation: useCreateTodo");
    expect(output).toContain("useUpdateMutation: useUpdateTodo");
    expect(output).toContain('retries: false');
  });

  it("matches snapshot for fixture spec", async () => {
    const doc = await loadSpec(fixturePath);
    const collections = discoverCollections({doc});
    const output = emitSdk({collections, doc});
    expect(output).toMatchSnapshot();
  });
});

describe("loadSpec", () => {
  it("loads a local JSON file", async () => {
    const doc = await loadSpec(fixturePath);
    expect(doc.paths["/todos"]).toBeDefined();
  });

  it("loads JSON from a file://-style path via readFile", async () => {
    const raw = await readFile(fixturePath, "utf8");
    const parsed = JSON.parse(raw) as OpenApiDocument;
    expect(parsed.openapi).toBe("3.0.0");
  });
});
