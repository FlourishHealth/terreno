import {beforeEach, describe, expect, it} from "bun:test";
import mongoose, {Schema} from "mongoose";
import {OwnerQueryFilter, Permissions} from "../permissions";
import {handleCreate, handleDelete, handleList, handleRead, handleUpdate} from "./handlers";
import {clearMCPRegistry, registerMCPModel} from "./registry";
import {generateAllTools} from "./toolGenerator";
import type {MCPRegistryEntry} from "./types";

// Test model
const todoSchema = new Schema({
  completed: {default: false, description: "Whether the todo is completed", type: Boolean},
  ownerId: {description: "Owner of the todo", ref: "User", type: Schema.Types.ObjectId},
  title: {description: "Todo title", required: true, type: String},
});

let TodoModel: mongoose.Model<any>;
try {
  TodoModel = mongoose.model("MCPTodo");
} catch {
  TodoModel = mongoose.model("MCPTodo", todoSchema);
}

const adminUser = {
  _id: new mongoose.Types.ObjectId(),
  admin: true,
  id: "",
};
adminUser.id = adminUser._id.toString();

const normalUser = {
  _id: new mongoose.Types.ObjectId(),
  admin: false,
  id: "",
};
normalUser.id = normalUser._id.toString();

const otherUser = {
  _id: new mongoose.Types.ObjectId(),
  admin: false,
  id: "",
};
otherUser.id = otherUser._id.toString();

const createEntry = (): MCPRegistryEntry => ({
  config: {
    maxLimit: 10,
    methods: ["create", "list", "read", "update", "delete"],
  },
  model: TodoModel,
  modelName: "MCPTodo",
  options: {
    permissions: {
      create: [Permissions.IsAuthenticated],
      delete: [Permissions.IsOwner],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsAuthenticated],
      update: [Permissions.IsOwner],
    },
    preCreate: (body: any, req: any) => ({
      ...body,
      ownerId: req.user?._id,
    }),
    queryFields: ["completed", "ownerId"],
    queryFilter: OwnerQueryFilter,
    sort: "-title",
  },
});

describe("MCP Integration", () => {
  let entry: MCPRegistryEntry;

  beforeEach(async () => {
    await TodoModel.deleteMany({});
    clearMCPRegistry();
    entry = createEntry();
  });

  describe("handleCreate", () => {
    it("creates a document with authenticated user", async () => {
      const result = await handleCreate(entry, {title: "Test todo"}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toBeDefined();
      expect(parsed.data.title).toBe("Test todo");
      expect(parsed.data.completed).toBe(false);
    });

    it("sets ownerId via preCreate", async () => {
      const result = await handleCreate(entry, {title: "Owned todo"}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(String(parsed.data.ownerId)).toBe(normalUser.id);
    });

    it("denies create without user", async () => {
      const result = await handleCreate(entry, {title: "Test"});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("Permission denied");
    });
  });

  describe("handleList", () => {
    beforeEach(async () => {
      await TodoModel.create([
        {completed: false, ownerId: normalUser._id, title: "Todo 1"},
        {completed: true, ownerId: normalUser._id, title: "Todo 2"},
        {completed: false, ownerId: otherUser._id, title: "Todo 3"},
      ]);
    });

    it("lists documents filtered by owner", async () => {
      const result = await handleList(entry, {}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.total).toBe(2);
    });

    it("admin can see all via query filter (returns admin's own items)", async () => {
      // OwnerQueryFilter filters by ownerId = user.id, even for admins
      const result = await handleList(entry, {}, adminUser as any);
      const parsed = JSON.parse(result.content[0].text);

      // Admin has no todos
      expect(parsed.data).toHaveLength(0);
    });

    it("enforces maxLimit", async () => {
      // Create more items than maxLimit
      const items = Array.from({length: 15}, (_, i) => ({
        ownerId: normalUser._id,
        title: `Item ${i}`,
      }));
      await TodoModel.create(items);

      const result = await handleList(entry, {limit: 100}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      // maxLimit is 10
      expect(parsed.data.length).toBeLessThanOrEqual(10);
    });

    it("supports pagination", async () => {
      const result = await handleList(entry, {limit: 1, page: 2}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.page).toBe(2);
    });

    it("supports filtering by query fields", async () => {
      const result = await handleList(entry, {completed: true}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].title).toBe("Todo 2");
    });

    it("denies list without user", async () => {
      const result = await handleList(entry, {});
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBeDefined();
    });
  });

  describe("handleRead", () => {
    it("reads a document by ID", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Read me"});
      const result = await handleRead(entry, {id: doc._id.toString()}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.title).toBe("Read me");
    });

    it("returns not found for invalid ID", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await handleRead(entry, {id: fakeId}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("not found");
    });
  });

  describe("handleUpdate", () => {
    it("updates a document", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Update me"});
      const result = await handleUpdate(
        entry,
        {id: doc._id.toString(), title: "Updated"},
        normalUser as any
      );
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.title).toBe("Updated");
    });

    it("denies update by non-owner", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Not yours"});
      const result = await handleUpdate(
        entry,
        {id: doc._id.toString(), title: "Hijacked"},
        otherUser as any
      );
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("Permission denied");
    });

    it("admin can update any document", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Admin update"});
      const result = await handleUpdate(
        entry,
        {id: doc._id.toString(), title: "Admin updated"},
        adminUser as any
      );
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.title).toBe("Admin updated");
    });
  });

  describe("handleDelete", () => {
    it("deletes a document", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Delete me"});
      const result = await handleDelete(entry, {id: doc._id.toString()}, normalUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.success).toBe(true);

      // Verify deleted
      const found = await TodoModel.findById(doc._id);
      expect(found).toBeNull();
    });

    it("denies delete by non-owner", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Protected"});
      const result = await handleDelete(entry, {id: doc._id.toString()}, otherUser as any);
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.error).toBeDefined();
    });
  });

  describe("excludeFields", () => {
    it("strips excluded fields from responses", async () => {
      const entryWithExcludes: MCPRegistryEntry = {
        ...entry,
        config: {
          ...entry.config,
          excludeFields: ["ownerId"],
        },
      };

      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Stripped"});
      const result = await handleRead(
        entryWithExcludes,
        {id: doc._id.toString()},
        normalUser as any
      );
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.title).toBe("Stripped");
      expect(parsed.data.ownerId).toBeUndefined();
    });
  });

  describe("mcpResponseHandler", () => {
    it("uses custom response handler", async () => {
      const entryWithHandler: MCPRegistryEntry = {
        ...entry,
        config: {
          ...entry.config,
          mcpResponseHandler: async (value: any, method: string) => {
            if (Array.isArray(value)) {
              return value.map((v: any) => ({method, summary: v.title}));
            }
            return {method, summary: value.title};
          },
        },
      };

      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Custom"});
      const result = await handleRead(
        entryWithHandler,
        {id: doc._id.toString()},
        normalUser as any
      );
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.data.summary).toBe("Custom");
      expect(parsed.data.method).toBe("read");
    });
  });

  describe("registry and tool generation", () => {
    it("registerMCPModel adds to registry", () => {
      registerMCPModel(TodoModel, {methods: ["list"]}, entry.options);
      const tools = generateAllTools([entry]);

      expect(tools.length).toBeGreaterThan(0);
    });

    it("generates correct tool names", () => {
      const tools = generateAllTools([entry]);
      const names = tools.map((t) => t.name);

      expect(names).toContain("mcptodos_create");
      expect(names).toContain("mcptodos_list");
      expect(names).toContain("mcptodos_read");
      expect(names).toContain("mcptodos_update");
      expect(names).toContain("mcptodos_delete");
    });
  });
});
