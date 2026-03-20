import {describe, expect, it} from "bun:test";
import mongoose, {Schema} from "mongoose";

import {Permissions} from "../permissions";
import {generateAllTools, generateToolsForEntry} from "./toolGenerator";
import type {MCPRegistryEntry} from "./types";

const createTestModel = () => {
  try {
    return mongoose.model("MCPToolGenTest");
  } catch {
    const schema = new Schema({
      completed: {default: false, description: "Whether the item is complete", type: Boolean},
      name: {description: "The name", required: true, type: String},
      ownerId: {description: "Owner", ref: "User", type: Schema.Types.ObjectId},
    });
    return mongoose.model("MCPToolGenTest", schema);
  }
};

const createEntry = (overrides?: Partial<MCPRegistryEntry>): MCPRegistryEntry => {
  const model = createTestModel();
  return {
    config: {methods: ["list", "read"]},
    model,
    modelName: model.modelName,
    options: {
      permissions: {
        create: [Permissions.IsAuthenticated],
        delete: [Permissions.IsOwner],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsOwner],
        update: [Permissions.IsOwner],
      },
      queryFields: ["completed"],
    },
    ...overrides,
  };
};

describe("generateToolsForEntry", () => {
  it("generates tools for default methods (list, read)", () => {
    const entry = createEntry();
    const tools = generateToolsForEntry(entry);

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe("mcptoolgentests_list");
    expect(tools[1].name).toBe("mcptoolgentests_read");
  });

  it("generates tools for all CRUD methods", () => {
    const entry = createEntry({
      config: {methods: ["create", "list", "read", "update", "delete"]},
    });
    const tools = generateToolsForEntry(entry);

    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain("mcptoolgentests_create");
    expect(names).toContain("mcptoolgentests_list");
    expect(names).toContain("mcptoolgentests_read");
    expect(names).toContain("mcptoolgentests_update");
    expect(names).toContain("mcptoolgentests_delete");
  });

  it("uses custom toolPrefix", () => {
    const entry = createEntry({config: {methods: ["list"], toolPrefix: "items"}});
    const tools = generateToolsForEntry(entry);

    expect(tools[0].name).toBe("items_list");
  });

  it("skips methods with empty permission arrays", () => {
    const entry = createEntry({
      config: {methods: ["list", "read", "delete"]},
      options: {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [], // disabled
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsOwner],
          update: [Permissions.IsOwner],
        },
      } as any,
    });
    const tools = generateToolsForEntry(entry);

    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("mcptoolgentests_delete");
  });

  it("generates valid input schemas", () => {
    const entry = createEntry({config: {methods: ["list", "read"]}});
    const tools = generateToolsForEntry(entry);

    const listTool = tools.find((t) => t.name.endsWith("_list"));
    expect(listTool?.inputSchema).toBeDefined();
    expect(listTool?.inputSchema.type).toBe("object");
    expect(listTool?.inputSchema.properties).toBeDefined();

    const readTool = tools.find((t) => t.name.endsWith("_read"));
    expect(readTool?.inputSchema).toBeDefined();
    expect(readTool?.inputSchema.properties?.id).toBeDefined();
  });

  it("includes descriptions on tools", () => {
    const entry = createEntry();
    const tools = generateToolsForEntry(entry);

    expect(tools[0].description).toBeTruthy();
    expect(tools[0].description.length).toBeGreaterThan(10);
  });
});

describe("generateAllTools", () => {
  it("generates tools from multiple entries", () => {
    const entry1 = createEntry();
    const entry2 = createEntry({
      config: {methods: ["list"], toolPrefix: "others"},
    });

    const tools = generateAllTools([entry1, entry2]);
    expect(tools.length).toBe(3); // 2 from entry1 + 1 from entry2
  });
});

describe("tool pluralization", () => {
  it("pluralizes normal names", () => {
    const entry = createEntry({config: {methods: ["list"]}});
    const tools = generateToolsForEntry(entry);
    // MCPToolGenTest -> mcptoolgentests
    expect(tools[0].name).toContain("mcptoolgentests");
  });
});
