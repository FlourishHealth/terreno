import {beforeEach, describe, expect, it, type Mock} from "bun:test";
import {Writable} from "node:stream";
import * as Sentry from "@sentry/bun";
import mongoose, {Schema} from "mongoose";
import winston from "winston";

import {winstonLogger} from "../logger";
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

interface CapturedLog {
  level: string;
  message: string;
  terrenoLabels?: Record<string, string>;
  terrenoLogPrefix?: string;
}

const captureLogs = async (callback: () => Promise<void>): Promise<CapturedLog[]> => {
  const logs: CapturedLog[] = [];
  const transport = new winston.transports.Stream({
    format: winston.format((info) => {
      logs.push({
        level: info.level,
        message: String(info.message),
        terrenoLabels: info.terrenoLabels as Record<string, string> | undefined,
        terrenoLogPrefix: info.terrenoLogPrefix as string | undefined,
      });
      return info;
    })(),
    stream: new Writable({
      write(_chunk, _encoding, done) {
        done();
      },
    }),
  });
  winstonLogger.add(transport);
  try {
    await callback();
  } finally {
    winstonLogger.remove(transport);
  }
  return logs;
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
      },
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

describe("tool-call observability", () => {
  const captureException = Sentry.captureException as Mock<typeof Sentry.captureException>;

  beforeEach(async () => {
    captureException.mockClear();
    await createTestModel().deleteMany({});
  });

  it("logs successful calls with stable MCP labels", async () => {
    const entry = createEntry({
      config: {methods: ["create"]},
      options: {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAny],
          delete: [],
          list: [],
          read: [],
          update: [],
        },
      },
    });
    const [tool] = generateToolsForEntry(entry);

    const logs = await captureLogs(async () => {
      const result = await tool.handler({name: "observable"});
      expect(result.isError).not.toBe(true);
    });

    const succeeded = logs.find((line) => line.message.includes("MCP tool call succeeded"));
    expect(succeeded?.level).toBe("info");
    expect(succeeded?.terrenoLogPrefix).toBe("[MCPTool]");
    expect(succeeded?.terrenoLabels).toEqual({
      mcpMethod: "create",
      mcpModel: "MCPToolGenTest",
      mcpTool: "mcptoolgentests_create",
    });
  });

  it("warns for expected refusals without capturing an exception", async () => {
    const [tool] = generateToolsForEntry(createEntry({config: {methods: ["list"]}}));

    const logs = await captureLogs(async () => {
      const result = await tool.handler({});
      expect(result.isError).toBe(true);
    });

    expect(logs.some((line) => line.level === "warn" && line.message.includes("refused"))).toBe(
      true
    );
    expect(captureException).not.toHaveBeenCalled();
  });

  it("captures internal failures in Sentry without exposing the cause to the client", async () => {
    process.env.USE_SENTRY_LOGGING = "true";
    const entry = createEntry({
      config: {methods: ["create"]},
      options: {
        allowAnonymous: true,
        permissions: {
          create: [Permissions.IsAny],
          delete: [],
          list: [],
          read: [],
          update: [],
        },
      },
    });
    const [tool] = generateToolsForEntry(entry);

    const logs = await captureLogs(async () => {
      const result = await tool.handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Create failed");
      expect(result.content[0].text).not.toContain("ValidationError:");
      expect(Object.keys(result)).toEqual(["content", "isError"]);
    });

    expect(logs.some((line) => line.level === "error" && line.message.includes("Caught:"))).toBe(
      true
    );
    expect(logs.some((line) => line.message.includes("MCP tool call failed"))).toBe(true);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe("tool pluralization", () => {
  it("pluralizes normal names", () => {
    const entry = createEntry({config: {methods: ["list"]}});
    const tools = generateToolsForEntry(entry);
    // MCPToolGenTest -> mcptoolgentests
    expect(tools[0].name).toContain("mcptoolgentests");
  });

  it("adds -es to sibilant endings", () => {
    const entry = createEntry({config: {methods: ["list"]}, modelName: "Status"});
    const tools = generateToolsForEntry(entry);

    expect(tools[0].name).toBe("statuses_list");
  });

  it("adds -ies to consonant-y endings", () => {
    const entry = createEntry({config: {methods: ["list"]}, modelName: "Category"});
    const tools = generateToolsForEntry(entry);

    expect(tools[0].name).toBe("categories_list");
  });

  it("lets toolPrefix override an irregular plural", () => {
    const entry = createEntry({
      config: {methods: ["list"], toolPrefix: "people"},
      modelName: "Person",
    });
    const tools = generateToolsForEntry(entry);

    expect(tools[0].name).toBe("people_list");
  });
});
