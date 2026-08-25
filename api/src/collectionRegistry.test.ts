import {beforeEach, describe, expect, it} from "bun:test";

import {Permissions} from "./permissions";
import {FoodModel} from "./tests";
import {
  clearCollectionRegistry,
  getCollection,
  listCollections,
  registerCollection,
  replaceCollectionOptions,
} from "./collectionRegistry";
import {clearMCPRegistry, getMCPRegistry} from "./mcp/registry";

const baseOptions = {
  permissions: {
    create: [Permissions.IsAny],
    delete: [Permissions.IsAny],
    list: [Permissions.IsAny],
    read: [Permissions.IsAny],
    update: [Permissions.IsAny],
  },
};

describe("CollectionRegistry", () => {
  beforeEach(() => {
    clearCollectionRegistry();
  });

  it("stores one catalog record per route path on registerCollection", () => {
    registerCollection({
      model: FoodModel,
      options: baseOptions,
      routePath: "/food",
    });

    const record = getCollection("/food");
    expect(record?.routePath).toBe("/food");
    expect(record?.model).toBe(FoodModel);
    expect(record?.options).toBe(baseOptions);
    expect(listCollections()).toHaveLength(1);
  });

  it("replaceCollectionOptions updates options for a registered path", () => {
    registerCollection({
      model: FoodModel,
      options: baseOptions,
      routePath: "/food",
    });
    const updatedOptions = {
      ...baseOptions,
      permissions: {...baseOptions.permissions, list: [Permissions.IsAuthenticated]},
    };
    replaceCollectionOptions("/food", updatedOptions);

    expect(getCollection("/food")?.options).toBe(updatedOptions);
  });

  it("replaceCollectionOptions no-ops when the route path is unknown", () => {
    registerCollection({
      model: FoodModel,
      options: baseOptions,
      routePath: "/food",
    });
    const originalOptions = getCollection("/food")?.options;
    replaceCollectionOptions("/missing", {
      permissions: {},
    } as never);

    expect(getCollection("/food")?.options).toBe(originalOptions);
  });

  it("replaceCollectionOptions updates MCP registry views with the same options object", () => {
    clearMCPRegistry();
    registerCollection({
      model: FoodModel,
      options: {...baseOptions, mcp: {methods: ["list"]}},
      routePath: "/food",
    });
    const updatedOptions = {
      ...baseOptions,
      mcp: {methods: ["read"]},
    } as typeof baseOptions & {mcp: {methods: ["read"]}};
    replaceCollectionOptions("/food", updatedOptions);

    expect(getCollection("/food")?.options).toBe(updatedOptions);
    expect(getMCPRegistry()[0]?.options).toBe(updatedOptions);
  });
});
