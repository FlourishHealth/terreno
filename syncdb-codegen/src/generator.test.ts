import {describe, expect, it} from "bun:test";

import {generateSyncDbDescriptors} from "./generator";

const sampleOpenApi = {
  paths: {
    "/auth/login": {
      post: {operationId: "login", tags: ["auth"]},
    },
    "/todos": {
      get: {operationId: "getTodos", tags: ["todos"]},
      post: {operationId: "postTodos", tags: ["todos"]},
    },
    "/todos/{id}": {
      delete: {operationId: "deleteTodosById", tags: ["todos"]},
      get: {operationId: "getTodosById", tags: ["todos"]},
      patch: {operationId: "patchTodosById", tags: ["todos"]},
    },
  },
};

describe("generateSyncDbDescriptors", () => {
  it("derives a CRUD descriptor for a resource collection", () => {
    const {descriptors} = generateSyncDbDescriptors({openapi: sampleOpenApi});
    const todos = descriptors.find((d) => d.collection === "todos");

    expect(todos).toBeDefined();
    expect(todos?.operations.list).toMatchObject({method: "get", path: "/todos"});
    expect(todos?.operations.create).toMatchObject({method: "post", path: "/todos"});
    expect(todos?.operations.read).toMatchObject({method: "get", path: "/todos/{id}"});
    expect(todos?.operations.update).toMatchObject({method: "patch", path: "/todos/{id}"});
    expect(todos?.operations.delete).toMatchObject({method: "delete", path: "/todos/{id}"});
  });

  it("ignores non-resource paths like /auth/login", () => {
    const {descriptors} = generateSyncDbDescriptors({openapi: sampleOpenApi});
    expect(descriptors.find((d) => d.collection === "auth")).toBeUndefined();
    expect(descriptors).toHaveLength(1);
  });

  it("emits a typed descriptor source module", () => {
    const {source} = generateSyncDbDescriptors({openapi: sampleOpenApi});
    expect(source).toContain("export const syncDbDescriptors");
    expect(source).toContain('"todos"');
    expect(source).toContain("as const");
  });

  it("returns no descriptors for an empty spec", () => {
    const {descriptors, source} = generateSyncDbDescriptors({openapi: {paths: {}}});
    expect(descriptors).toEqual([]);
    expect(source).toContain("export const syncDbDescriptors");
  });

  it("excludes a collection-only resource with no item-level operations", () => {
    const {descriptors} = generateSyncDbDescriptors({
      openapi: {paths: {"/health": {get: {operationId: "getHealth"}}}},
    });
    expect(descriptors).toEqual([]);
  });

  it("supports PUT updates and propagates operationId", () => {
    const {descriptors} = generateSyncDbDescriptors({
      openapi: {
        paths: {
          "/widgets": {post: {operationId: "createWidget"}},
          "/widgets/{id}": {put: {operationId: "replaceWidget"}},
        },
      },
    });
    const widgets = descriptors.find((d) => d.collection === "widgets");
    expect(widgets?.operations.create?.operationId).toBe("createWidget");
    expect(widgets?.operations.update).toMatchObject({
      method: "put",
      operationId: "replaceWidget",
    });
  });
});
