import {beforeEach, describe, expect, it} from "bun:test";
import {
  clearMCPRegistry,
  type MCPToolResult,
  Permissions,
  registerMCPModel,
  registerMCPTool,
  type User,
} from "@terreno/api";
import {assert} from "chai";
import mongoose, {Schema} from "mongoose";
import {z} from "zod";

import {getMCPTools} from "./getMCPTools";

interface NoteFields {
  _id: mongoose.Types.ObjectId;
  title: string;
  [key: string]: unknown;
}

const noteSchema = new Schema({
  title: {required: true, type: String},
});

const getOrCreateModel = (): mongoose.Model<NoteFields> => {
  try {
    return mongoose.model<NoteFields>("AiMcpNote");
  } catch {
    return mongoose.model<NoteFields>("AiMcpNote", noteSchema);
  }
};

const NoteModel = getOrCreateModel();

const asUser = (): User => {
  const _id = new mongoose.Types.ObjectId();
  return {_id, admin: false, id: _id.toString()} as unknown as User;
};

describe("getMCPTools", () => {
  beforeEach(() => {
    clearMCPRegistry();
  });

  it("returns an empty object when no MCP models are registered", () => {
    expect(Object.keys(getMCPTools())).toEqual([]);
  });

  it("wraps registered MCP tools as Vercel AI SDK tools", async () => {
    registerMCPModel(
      NoteModel,
      {methods: ["create", "list"], toolPrefix: "notes"},
      {
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [],
          list: [Permissions.IsAuthenticated],
          read: [Permissions.IsAuthenticated],
          update: [],
        },
      }
    );

    const user = asUser();
    const tools = getMCPTools(user);

    expect(Object.keys(tools).sort()).toEqual(["notes_create", "notes_list"]);

    const created = await tools.notes_create.execute?.({title: "From AI tools"});
    expect(created).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({title: "From AI tools"}),
      })
    );
  });

  it("exposes custom tools with their description and json schema", async () => {
    registerMCPTool({
      description: "Echoes structured json back to the caller",
      handler: async (args): Promise<MCPToolResult> => ({
        content: [{text: JSON.stringify({echoed: args.value}), type: "text"}],
      }),
      name: "echo_json",
      zodSchema: z.object({value: z.string()}),
    });

    const tools = getMCPTools();
    assert.deepEqual(Object.keys(tools), ["echo_json"]);
    assert.equal(tools.echo_json.description, "Echoes structured json back to the caller");
    assert.deepEqual(await tools.echo_json.execute?.({value: "hi"}), {echoed: "hi"});
  });

  it("returns joined plain text when the tool response is not json", async () => {
    registerMCPTool({
      description: "Returns prose",
      handler: async (): Promise<MCPToolResult> => ({
        content: [
          {text: "first line", type: "text"},
          {text: "second line", type: "text"},
        ],
      }),
      name: "prose",
      zodSchema: z.object({}),
    });

    const tools = getMCPTools();
    assert.equal(await tools.prose.execute?.({}), "first line\nsecond line");
  });

  it("passes the authenticated user through to custom tool handlers", async () => {
    const seenUserIds: (string | undefined)[] = [];
    registerMCPTool({
      description: "Records the calling user",
      handler: async (_args, user): Promise<MCPToolResult> => {
        seenUserIds.push(user?.id);
        return {content: [{text: "ok", type: "text"}]};
      },
      name: "whoami",
      zodSchema: z.object({}),
    });

    const user = asUser();
    await getMCPTools(user).whoami.execute?.({});
    await getMCPTools().whoami.execute?.({});
    assert.deepEqual(seenUserIds, [user.id, undefined]);
  });
});
