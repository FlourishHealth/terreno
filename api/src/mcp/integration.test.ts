import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import mongoose, {Schema} from "mongoose";

import type {User} from "../auth";
import {OwnerQueryFilter, Permissions} from "../permissions";
import {handleCreate, handleDelete, handleList, handleRead, handleUpdate} from "./handlers";
import {clearMCPRegistry, registerMCPModel} from "./registry";
import {generateAllTools} from "./toolGenerator";
import type {MCPRegistryEntry, MCPRequest} from "./types";

// Test model
const todoSchema = new Schema({
  completed: {default: false, description: "Whether the todo is completed", type: Boolean},
  dueDate: {description: "When the todo is due", type: Date},
  metadata: {description: "Arbitrary metadata", type: Schema.Types.Mixed},
  ownerId: {description: "Owner of the todo", ref: "MCPOwner", type: Schema.Types.ObjectId},
  title: {description: "Todo title", required: true, type: String},
});

const ownerSchema = new Schema({
  email: {description: "Owner email", type: String},
  tier: {description: "Owner subscription tier", type: String},
});

const getOrCreateModel = (name: string, schema: Schema): mongoose.Model<TestDocFields> => {
  try {
    return mongoose.model<TestDocFields>(name);
  } catch {
    return mongoose.model<TestDocFields>(name, schema);
  }
};

/** Loose document shape shared by the test models. */
interface TestDocFields {
  _id: mongoose.Types.ObjectId;
  [key: string]: unknown;
}

const TodoModel = getOrCreateModel("MCPTodo", todoSchema);
const OwnerModel = getOrCreateModel("MCPOwner", ownerSchema);

interface TestUser {
  _id: mongoose.Types.ObjectId;
  admin: boolean;
  id: string;
}

const makeUser = (admin = false): TestUser => {
  const _id = new mongoose.Types.ObjectId();
  return {_id, admin, id: _id.toString()};
};

/** Test users stand in for UserDocument, which needs a consumer model to construct. */
const asUser = (user: TestUser): User => user as unknown as User;

const adminUser = makeUser(true);
const normalUser = makeUser();
const otherUser = makeUser();

/**
 * Tool results are JSON text. Tests assert on deeply nested response shapes, so the
 * parsed value is deliberately loose rather than modelled per assertion.
 */
// biome-ignore lint/suspicious/noExplicitAny: parsed tool JSON is asserted at arbitrary depth
type ParsedToolResult = Record<string, any>;

const parseResult = (result: {content: Array<{text: string}>}): ParsedToolResult => {
  return JSON.parse(result.content[0].text);
};

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
    preCreate: (body, req) => ({
      ...(body as Record<string, unknown>),
      ownerId: (req.user as unknown as TestUser | undefined)?._id,
    }),
    queryFields: ["completed", "ownerId", "title"],
    queryFilter: OwnerQueryFilter,
    sort: "-title",
  },
});

describe("MCP Integration", () => {
  let entry: MCPRegistryEntry;

  beforeEach(async () => {
    await TodoModel.deleteMany({});
    await OwnerModel.deleteMany({});
    clearMCPRegistry();
    entry = createEntry();
  });

  describe("handleCreate", () => {
    it("creates a document with authenticated user", async () => {
      const result = await handleCreate(entry, {title: "Test todo"}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.data).toBeDefined();
      expect(parsed.data.title).toBe("Test todo");
      expect(parsed.data.completed).toBe(false);
    });

    it("sets ownerId via preCreate", async () => {
      const result = await handleCreate(entry, {title: "Owned todo"}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(String(parsed.data.ownerId)).toBe(normalUser.id);
    });

    it("denies create without user", async () => {
      const result = await handleCreate(entry, {title: "Test"});
      const parsed = parseResult(result);

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
      const result = await handleList(entry, {}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.data).toHaveLength(2);
      expect(parsed.total).toBe(2);
    });

    it("admin can see all via query filter (returns admin's own items)", async () => {
      // OwnerQueryFilter filters by ownerId = user.id, even for admins
      const result = await handleList(entry, {}, asUser(adminUser));
      const parsed = parseResult(result);

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

      const result = await handleList(entry, {limit: 100}, asUser(normalUser));
      const parsed = parseResult(result);

      // maxLimit is 10
      expect(parsed.data.length).toBeLessThanOrEqual(10);
    });

    it("supports pagination", async () => {
      const result = await handleList(entry, {limit: 1, page: 2}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.page).toBe(2);
    });

    it("clamps a page below 1 to the first page", async () => {
      const result = await handleList(entry, {limit: 1, page: -3}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.page).toBe(1);
      expect(parsed.data).toHaveLength(1);
    });

    it("supports filtering by query fields", async () => {
      const result = await handleList(entry, {completed: true}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].title).toBe("Todo 2");
    });

    it("denies list without user", async () => {
      const result = await handleList(entry, {});
      const parsed = parseResult(result);

      expect(parsed.error).toBeDefined();
    });

    describe("query operators", () => {
      it("supports $in on an allowed field", async () => {
        const result = await handleList(
          entry,
          {title: {$in: ["Todo 1", "Todo 2"]}},
          asUser(normalUser)
        );
        const parsed = parseResult(result);

        expect(parsed.data).toHaveLength(2);
      });

      it("supports $ne on an allowed field", async () => {
        const result = await handleList(entry, {completed: {$ne: true}}, asUser(normalUser));
        const parsed = parseResult(result);

        expect(parsed.data).toHaveLength(1);
        expect(parsed.data[0].title).toBe("Todo 1");
      });

      it("supports $or across allowed fields", async () => {
        const result = await handleList(
          entry,
          {$or: [{title: "Todo 1"}, {completed: true}]},
          asUser(normalUser)
        );
        const parsed = parseResult(result);

        expect(parsed.data).toHaveLength(2);
      });

      it("still applies the owner query filter alongside $or", async () => {
        const result = await handleList(entry, {$or: [{title: "Todo 3"}]}, asUser(normalUser));
        const parsed = parseResult(result);

        // Todo 3 belongs to otherUser, so the owner filter excludes it
        expect(parsed.data).toHaveLength(0);
      });

      it("rejects operators that can execute code", async () => {
        const result = await handleList(
          entry,
          {title: {$where: "return true"}},
          asUser(normalUser)
        );
        const parsed = parseResult(result);

        expect(parsed.error).toContain("$where");
      });

      it("rejects a $or branch referencing a field outside queryFields", async () => {
        const result = await handleList(entry, {$or: [{metadata: "leak"}]}, asUser(normalUser));
        const parsed = parseResult(result);

        expect(parsed.error).toContain("metadata");
      });

      it("rejects $and with a non-array value", async () => {
        const result = await handleList(entry, {$and: {title: "Todo 1"}}, asUser(normalUser));
        const parsed = parseResult(result);

        expect(parsed.error).toContain("$and");
      });

      it("ignores filters on fields outside queryFields", async () => {
        const result = await handleList(entry, {metadata: "ignored"}, asUser(normalUser));
        const parsed = parseResult(result);

        expect(parsed.data).toHaveLength(2);
      });
    });
  });

  describe("handleRead", () => {
    it("reads a document by ID", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Read me"});
      const result = await handleRead(entry, {id: doc._id.toString()}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.data.title).toBe("Read me");
    });

    it("returns not found for invalid ID", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await handleRead(entry, {id: fakeId}, asUser(normalUser));
      const parsed = parseResult(result);

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
        asUser(normalUser)
      );
      const parsed = parseResult(result);

      expect(parsed.data.title).toBe("Updated");
    });

    it("denies update by non-owner", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Not yours"});
      const result = await handleUpdate(
        entry,
        {id: doc._id.toString(), title: "Hijacked"},
        asUser(otherUser)
      );
      const parsed = parseResult(result);

      expect(parsed.error).toBeDefined();
      expect(parsed.error).toContain("Permission denied");
    });

    it("admin can update any document", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Admin update"});
      const result = await handleUpdate(
        entry,
        {id: doc._id.toString(), title: "Admin updated"},
        asUser(adminUser)
      );
      const parsed = parseResult(result);

      expect(parsed.data.title).toBe("Admin updated");
    });
  });

  describe("handleDelete", () => {
    it("deletes a document", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Delete me"});
      const result = await handleDelete(entry, {id: doc._id.toString()}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.success).toBe(true);

      // Verify deleted
      const found = await TodoModel.findById(doc._id);
      expect(found).toBeNull();
    });

    it("denies delete by non-owner", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Protected"});
      const result = await handleDelete(entry, {id: doc._id.toString()}, asUser(otherUser));
      const parsed = parseResult(result);

      expect(parsed.error).toBeDefined();
    });

    it("populates the document before the object-level permission check", async () => {
      const owner = await OwnerModel.create({email: "owner@example.com", tier: "pro"});
      const doc = await TodoModel.create({ownerId: owner._id, title: "Populated delete"});

      let seenTier: unknown;
      const entryWithPopulate: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          permissions: {
            ...entry.options.permissions,
            // Inspect a populated ref, which only works if handleDelete populated first
            delete: [
              (_method, _user, obj) => {
                if (!obj) {
                  return true;
                }
                seenTier = (obj as {ownerId?: {tier?: string}}).ownerId?.tier;
                return seenTier === "pro";
              },
            ],
          },
          populatePaths: [{path: "ownerId"}],
        },
      };

      const result = await handleDelete(
        entryWithPopulate,
        {id: doc._id.toString()},
        asUser(normalUser)
      );
      const parsed = parseResult(result);

      expect(seenTier).toBe("pro");
      expect(parsed.success).toBe(true);
    });
  });

  describe("lifecycle hook failures", () => {
    it("reports a preCreate hook that returns null", async () => {
      const blocked: MCPRegistryEntry = {
        ...entry,
        options: {...entry.options, preCreate: () => null},
      };

      const parsed = parseResult(await handleCreate(blocked, {title: "No"}, asUser(normalUser)));

      expect(parsed.error).toContain("Create not allowed");
    });

    it("reports a preCreate hook that throws", async () => {
      const failing: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          preCreate: () => {
            throw new Error("boom");
          },
        },
      };

      const parsed = parseResult(await handleCreate(failing, {title: "No"}, asUser(normalUser)));

      expect(parsed.error).toContain("preCreate hook failed: boom");
    });

    it("reports a postCreate hook that throws", async () => {
      const failing: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          postCreate: () => {
            throw new Error("after");
          },
        },
      };

      const parsed = parseResult(await handleCreate(failing, {title: "Yes"}, asUser(normalUser)));

      expect(parsed.error).toContain("postCreate hook failed: after");
    });

    it("reports a preUpdate hook that returns null", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Blocked update"});
      const blocked: MCPRegistryEntry = {
        ...entry,
        options: {...entry.options, preUpdate: () => null},
      };

      const parsed = parseResult(
        await handleUpdate(blocked, {id: doc._id.toString(), title: "No"}, asUser(normalUser))
      );

      expect(parsed.error).toContain("Update not allowed");
    });

    it("reports a postUpdate hook that throws", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Post update"});
      const failing: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          postUpdate: () => {
            throw new Error("late");
          },
        },
      };

      const parsed = parseResult(
        await handleUpdate(failing, {id: doc._id.toString(), title: "Changed"}, asUser(normalUser))
      );

      expect(parsed.error).toContain("postUpdate hook failed: late");
    });

    it("reports a preDelete hook that returns null", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Blocked delete"});
      const blocked: MCPRegistryEntry = {
        ...entry,
        options: {...entry.options, preDelete: () => null},
      };

      const parsed = parseResult(
        await handleDelete(blocked, {id: doc._id.toString()}, asUser(normalUser))
      );

      expect(parsed.error).toContain("Delete not allowed");
    });

    it("reports a postDelete hook that throws", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Post delete"});
      const failing: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          postDelete: () => {
            throw new Error("cascade");
          },
        },
      };

      const parsed = parseResult(
        await handleDelete(failing, {id: doc._id.toString()}, asUser(normalUser))
      );

      expect(parsed.error).toContain("postDelete hook failed: cascade");
    });

    it("passes the update fields as the MCP request body, without the id", async () => {
      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Body check"});
      let seenBody: unknown;
      const withHook: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          preUpdate: (body, req: express.Request) => {
            seenBody = (req as unknown as MCPRequest).body;
            return body as Record<string, unknown>;
          },
        },
      };

      await handleUpdate(
        withHook,
        {id: doc._id.toString(), title: "Updated body"},
        asUser(normalUser)
      );

      expect(seenBody).toEqual({title: "Updated body"});
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
        asUser(normalUser)
      );
      const parsed = parseResult(result);

      expect(parsed.data.title).toBe("Stripped");
      expect(parsed.data.ownerId).toBeUndefined();
    });

    it("keeps ObjectIds and Dates JSON-serializable while stripping", async () => {
      const entryWithExcludes: MCPRegistryEntry = {
        ...entry,
        config: {...entry.config, excludeFields: ["ownerId"]},
      };

      const doc = await TodoModel.create({
        dueDate: new Date("2026-01-02T03:04:05.000Z"),
        ownerId: normalUser._id,
        title: "Serialization",
      });
      const result = await handleRead(
        entryWithExcludes,
        {id: doc._id.toString()},
        asUser(normalUser)
      );
      const parsed = parseResult(result);

      expect(parsed.data._id).toBe(doc._id.toString());
      expect(parsed.data.dueDate).toBe("2026-01-02T03:04:05.000Z");
    });

    it("strips a bare field name nested inside an object", async () => {
      const entryWithExcludes: MCPRegistryEntry = {
        ...entry,
        config: {...entry.config, excludeFields: ["secret"]},
      };

      const doc = await TodoModel.create({
        metadata: {nested: {secret: "hidden", visible: "shown"}, secret: "hidden"},
        ownerId: normalUser._id,
        title: "Nested",
      });
      const result = await handleRead(
        entryWithExcludes,
        {id: doc._id.toString()},
        asUser(normalUser)
      );
      const parsed = parseResult(result);

      expect(parsed.data.metadata.secret).toBeUndefined();
      expect(parsed.data.metadata.nested.secret).toBeUndefined();
      expect(parsed.data.metadata.nested.visible).toBe("shown");
    });

    it("strips a dot path through an array of subdocuments", async () => {
      const entryWithExcludes: MCPRegistryEntry = {
        ...entry,
        config: {...entry.config, excludeFields: ["metadata.items.token"]},
      };

      const doc = await TodoModel.create({
        metadata: {
          items: [
            {name: "one", token: "t1"},
            {name: "two", token: "t2"},
          ],
        },
        ownerId: normalUser._id,
        title: "Array paths",
      });
      const result = await handleRead(
        entryWithExcludes,
        {id: doc._id.toString()},
        asUser(normalUser)
      );
      const parsed = parseResult(result);

      expect(parsed.data.metadata.items).toHaveLength(2);
      for (const item of parsed.data.metadata.items) {
        expect(item.token).toBeUndefined();
        expect(item.name).toBeDefined();
      }
    });

    it("strips excluded fields from every item in a list response", async () => {
      const entryWithExcludes: MCPRegistryEntry = {
        ...entry,
        config: {...entry.config, excludeFields: ["ownerId"]},
      };

      await TodoModel.create([
        {ownerId: normalUser._id, title: "List 1"},
        {ownerId: normalUser._id, title: "List 2"},
      ]);
      const result = await handleList(entryWithExcludes, {}, asUser(normalUser));
      const parsed = parseResult(result);

      expect(parsed.data).toHaveLength(2);
      for (const item of parsed.data) {
        expect(item.ownerId).toBeUndefined();
      }
    });
  });

  describe("lifecycle hook request", () => {
    it("passes an Express-shaped MCP request to hooks", async () => {
      let seenRequest: MCPRequest | undefined;
      const entryWithHooks: MCPRegistryEntry = {
        ...entry,
        options: {
          ...entry.options,
          preCreate: (body, req: express.Request) => {
            seenRequest = req as unknown as MCPRequest;
            return {
              ...(body as Record<string, unknown>),
              ownerId: normalUser._id,
            };
          },
        },
      };

      await handleCreate(entryWithHooks, {title: "Hooked"}, asUser(normalUser));

      expect(seenRequest?.isMCPRequest).toBe(true);
      expect(seenRequest?.method).toBe("MCP");
      expect(seenRequest?.body).toEqual({title: "Hooked"});
      expect(seenRequest?.query).toEqual({});
      expect(seenRequest?.params).toEqual({});
      expect(seenRequest?.headers).toEqual({});
      expect((seenRequest?.user as unknown as TestUser | undefined)?.id).toBe(normalUser.id);
    });
  });

  describe("mcpResponseHandler", () => {
    it("uses custom response handler", async () => {
      const entryWithHandler: MCPRegistryEntry = {
        ...entry,
        config: {
          ...entry.config,
          mcpResponseHandler: async (value, method) => {
            if (Array.isArray(value)) {
              return value.map((v: {title?: string}) => ({method, summary: v.title ?? null}));
            }
            return {method, summary: (value as {title?: string}).title ?? null};
          },
        },
      };

      const doc = await TodoModel.create({ownerId: normalUser._id, title: "Custom"});
      const result = await handleRead(
        entryWithHandler,
        {id: doc._id.toString()},
        asUser(normalUser)
      );
      const parsed = parseResult(result);

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

    it("advertises filter operators and $and/$or on the list tool", () => {
      const tools = generateAllTools([entry]);
      const listTool = tools.find((t) => t.name === "mcptodos_list");

      expect(listTool?.inputSchema.properties?.$and).toBeDefined();
      expect(listTool?.inputSchema.properties?.$or).toBeDefined();
      expect(listTool?.description).toContain("$in");
    });
  });
});
