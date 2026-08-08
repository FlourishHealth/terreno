import {beforeEach, describe, expect, it} from "bun:test";
import express from "express";
import mongoose, {Schema} from "mongoose";
import supertest from "supertest";

import type {UserModel} from "../auth";
import {Permissions} from "../permissions";
import {clearMCPRegistry, registerMCPModel} from "./registry";
import {mountMCPServer} from "./server";

interface MCPServerDocFields {
  _id: mongoose.Types.ObjectId;
  title?: string;
}

const getModel = (name: string, schema: Schema): mongoose.Model<MCPServerDocFields> => {
  try {
    return mongoose.model<MCPServerDocFields>(name);
  } catch {
    return mongoose.model<MCPServerDocFields>(name, schema);
  }
};

const NoteModel = getModel(
  "MCPServerNote",
  new Schema({title: {description: "Note title", type: String}})
);
const userModel = getModel(
  "MCPServerUser",
  new Schema({email: {type: String}})
) as unknown as UserModel;

const registerNoteModel = (): void => {
  registerMCPModel(
    NoteModel,
    {methods: ["list", "read"]},
    {
      permissions: {
        create: [Permissions.IsAuthenticated],
        delete: [],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsAuthenticated],
        update: [Permissions.IsAuthenticated],
      },
      queryFields: ["title"],
    }
  );
};

const buildApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  mountMCPServer(app, {userModel});
  return app;
};

const initializeBody = {
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: {name: "test-client", version: "1.0.0"},
    protocolVersion: "2024-11-05",
  },
};

describe("mountMCPServer", () => {
  beforeEach(() => {
    clearMCPRegistry();
  });

  it("does not mount any routes when no models opt in", async () => {
    const app = buildApp();

    const res = await supertest(app).post("/mcp").send(initializeBody);

    expect(res.status).toBe(404);
  });

  it("serves an initialize handshake when a model opts in", async () => {
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .send(initializeBody);

    expect(res.status).toBe(200);
    expect(res.text).toContain("terreno-api-mcp");
  });

  it("lists the generated tools", async () => {
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .send({id: 2, jsonrpc: "2.0", method: "tools/list", params: {}});

    expect(res.text).toContain("mcpservernotes_list");
    expect(res.text).toContain("mcpservernotes_read");
  });

  it("invokes a tool handler with the user from the request headers", async () => {
    await NoteModel.deleteMany({});
    await NoteModel.create({title: "Visible note"});
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .send({
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {arguments: {}, name: "mcpservernotes_list"},
      });

    // No credentials are sent, so the list permission check denies the call
    expect(res.text).toContain("Permission denied");
  });

  it("returns a JSON-RPC 405 for GET", async () => {
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app).get("/mcp");

    expect(res.status).toBe(405);
    expect(res.body.error.message).toContain("Use POST");
    expect(res.body.jsonrpc).toBe("2.0");
  });

  it("returns a JSON-RPC 405 for DELETE", async () => {
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app).delete("/mcp");

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe(-32000);
  });

  it("returns a JSON-RPC 405 for PATCH", async () => {
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app).patch("/mcp").send({});

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe(-32000);
  });

  it("returns a JSON-RPC 405 for PUT", async () => {
    registerNoteModel();
    const app = buildApp();

    const res = await supertest(app).put("/mcp").send({});

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe(-32000);
  });

  it("returns a JSON-RPC error body when the request cannot be handled", async () => {
    registerNoteModel();
    const app = buildApp();

    // Missing the SSE accept header the streamable transport requires
    const res = await supertest(app).post("/mcp").set("accept", "text/plain").send(initializeBody);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.jsonrpc).toBe("2.0");
  });
});
