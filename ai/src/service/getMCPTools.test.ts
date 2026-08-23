import {beforeEach, describe, expect, it} from "bun:test";
import {clearMCPRegistry, Permissions, registerMCPModel, type User} from "@terreno/api";
import mongoose, {Schema} from "mongoose";

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
});
