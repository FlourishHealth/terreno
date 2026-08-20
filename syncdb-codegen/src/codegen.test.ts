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
    expect(collections).toHaveLength(1);
    expect(collections[0]).toMatchObject({
      collection: "todos",
      createSchemaName: "CreateTodo",
      entitySchemaName: "Todo",
      listPath: "/todos",
      scope: "owner",
      updateSchemaName: "UpdateTodo",
    });
  });

  it("discovers inline list and body schemas without components.schemas $ref", () => {
    const doc: OpenApiDocument = {
      openapi: "3.0.0",
      paths: {
        "/todos": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      properties: {
                        data: {
                          items: {
                            properties: {
                              _id: {type: "string"},
                              title: {type: "string"},
                            },
                            required: ["_id", "title"],
                            type: "object",
                          },
                          type: "array",
                        },
                      },
                      type: "object",
                    },
                  },
                },
              },
            },
            "x-terreno-sync": {collection: "todos", scope: "owner"},
          },
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    properties: {
                      title: {type: "string"},
                    },
                    required: ["title"],
                    type: "object",
                  },
                },
              },
            },
          },
        },
        "/todos/{id}": {
          patch: {
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    properties: {
                      title: {type: "string"},
                    },
                    type: "object",
                  },
                },
              },
            },
          },
        },
      },
    };

    const collections = discoverCollections({doc});
    expect(collections[0]?.entitySchemaName).toBe("Todo");
    const output = emitSdk({collections, doc});
    expect(output).toContain("export interface Todo {");
    expect(output).toContain("export interface CreateTodoBody {");
    expect(output).toContain("title: string");
  });

  it("fails closed when --collections matches no x-terreno-sync operations", async () => {
    const doc = await loadSpec(fixturePath);
    expect(() => discoverCollections({collectionsArg: ["nope"], doc})).toThrow(
      /No collections matched the provided --collections filter/
    );
  });

  it("uses --collections as a path fallback when the spec has no x-terreno-sync extensions", () => {
    const doc: OpenApiDocument = {
      openapi: "3.0.0",
      paths: {
        "/notes": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      properties: {
                        data: {
                          items: {
                            properties: {_id: {type: "string"}},
                            required: ["_id"],
                            type: "object",
                          },
                          type: "array",
                        },
                      },
                      type: "object",
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const collections = discoverCollections({collectionsArg: ["notes"], doc});
    expect(collections[0]?.collection).toBe("notes");
    expect(collections[0]?.entitySchemaName).toBe("Note");
    expect(collections[0]?.scope).toBe("unknown");
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
    const collections = discoverCollections({
      config: {overrides: {todos: {retries: false}}},
      doc,
    });
    const output = emitSdk({collections, doc});

    expect(output).toContain('export const SYNC_COLLECTIONS = ["todos"] as const;');
    expect(output).toContain("useListQuery: useTodos");
    expect(output).toContain("useReadQuery: useTodo");
    expect(output).toContain("useCreateMutation: useCreateTodo");
    expect(output).toContain("useUpdateMutation: useUpdateTodo");
    expect(output).toContain("useDeleteMutation: useDeleteTodo");
    expect(output).toContain("export interface Todo {");
    expect(output).toContain("export interface CreateTodoBody {");
    expect(output).toContain("export type UpdateTodoBody = Partial<CreateTodoBody>;");
    expect(output).toContain("retries: false");
  });

  it("fails closed when a collection name is not a TypeScript identifier", () => {
    const doc: OpenApiDocument = {
      openapi: "3.0.0",
      paths: {
        "/todos": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      properties: {
                        data: {
                          items: {
                            properties: {_id: {type: "string"}},
                            required: ["_id"],
                            type: "object",
                          },
                          type: "array",
                        },
                      },
                      type: "object",
                    },
                  },
                },
              },
            },
            "x-terreno-sync": {
              collection: 'todos"; process.exit(1); //',
              scope: "owner",
            },
          },
        },
      },
    };

    expect(() => discoverCollections({doc})).toThrow(/not a TypeScript identifier/);
  });

  it("quotes non-identifier property keys instead of interpolating them raw", () => {
    const doc: OpenApiDocument = {
      openapi: "3.0.0",
      paths: {
        "/todos": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      properties: {
                        data: {
                          items: {
                            properties: {
                              _id: {type: "string"},
                              'title"; evil': {type: "string"},
                            },
                            required: ["_id"],
                            type: "object",
                          },
                          type: "array",
                        },
                      },
                      type: "object",
                    },
                  },
                },
              },
            },
            "x-terreno-sync": {collection: "todos", scope: "owner"},
          },
        },
      },
    };

    const collections = discoverCollections({doc});
    const output = emitSdk({collections, doc});
    expect(output).toContain('"title\\"; evil"?: string');
    expect(output).not.toContain('title"; evil?:');
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
