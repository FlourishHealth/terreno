import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose, {model, Schema} from "mongoose";
import supertest from "supertest";

import {modelRouter} from "./api";
import type {UserModel as UserModelType} from "./auth";
import {clearMCPRegistry} from "./mcp/registry";
import {McpServiceToken} from "./models/mcpServiceToken";
import {Permissions} from "./permissions";
import {createdUpdatedPlugin} from "./plugins";
import {TerrenoApp} from "./terrenoApp";
import {authAsUser, setupDb, UserModel} from "./tests";

const typedUserModel = UserModel as unknown as UserModelType;

const PUBLIC_MCP_URL = "https://api.example.com";

const toolsCallBody = {
  id: 3,
  jsonrpc: "2.0",
  method: "tools/call",
  params: {arguments: {}, name: "tokenmcpnotes_list"},
};

const getNoteModel = (): mongoose.Model<{title?: string}> => {
  if (mongoose.models.TokenMcpNote) {
    return mongoose.models.TokenMcpNote as mongoose.Model<{title?: string}>;
  }
  const schema = new Schema({title: {description: "Note title", type: String}});
  schema.plugin(createdUpdatedPlugin);
  return model("TokenMcpNote", schema);
};

const TokenMcpNote = getNoteModel();

const noteRouter = () => {
  return modelRouter("/token-mcp-notes", TokenMcpNote, {
    mcp: {methods: ["list"], toolPrefix: "tokenmcpnotes"},
    permissions: {
      create: [],
      delete: [],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsAuthenticated],
      update: [],
    },
  });
};

describe("TerrenoApp mcpServiceTokens", () => {
  let notAdminId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const users = await setupDb();
    notAdminId = users[1]._id as mongoose.Types.ObjectId;
    await McpServiceToken.deleteMany({});
    await TokenMcpNote.deleteMany({});
    clearMCPRegistry();
  });

  it("does not serve token routes or accept mcp_ on /mcp when the flag is off", async () => {
    const app = new TerrenoApp({
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(noteRouter())
      .build();

    const missingRoutes = await supertest(app).get("/mcp/service-tokens");
    assert.equal(missingRoutes.status, 404);

    const issued = await McpServiceToken.issueFor({_id: notAdminId}, {name: "Ignored"});
    const mcpCall = await supertest(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${issued.token}`)
      .send(toolsCallBody);

    assert.include(mcpCall.text, "Permission denied: authentication required");
  });

  it("serves token routes and accepts mcp_ on /mcp when the flag is true", async () => {
    const app = new TerrenoApp({
      mcpServiceTokens: true,
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(noteRouter())
      .build();

    const agent = await authAsUser(app, "notAdmin");
    const created = await agent.post("/mcp/service-tokens").send({name: "Perplexity"});

    assert.equal(created.status, 200);
    assert.match(created.body.data.token, /^mcp_[0-9a-f]{64}$/);

    await TokenMcpNote.create({title: "Visible note"});

    const mcpCall = await supertest(app)
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .set("Authorization", `Bearer ${created.body.data.token}`)
      .send(toolsCallBody);

    assert.notInclude(mcpCall.text, "Permission denied");
    assert.include(mcpCall.text, "Visible note");
  });

  it("uses publicMcpUrl from the object form of the flag", async () => {
    const app = new TerrenoApp({
      mcpServiceTokens: {enabled: true, publicMcpUrl: PUBLIC_MCP_URL},
      skipListen: true,
      userModel: typedUserModel,
    }).build();

    const agent = await authAsUser(app, "notAdmin");
    const created = await agent.post("/mcp/service-tokens").send({name: "Named"});

    assert.equal(created.status, 200);
    assert.equal(created.body.data.mcpUrl, `${PUBLIC_MCP_URL}/mcp`);
  });

  it("documents the token routes in /openapi.json when enabled", async () => {
    const app = new TerrenoApp({
      mcpServiceTokens: true,
      skipListen: true,
      userModel: typedUserModel,
    }).build();

    const res = await supertest(app).get("/openapi.json");
    assert.equal(res.body.paths["/mcp/service-tokens"].post.operationId, "createMcpServiceToken");
  });

  it("authenticates GET and POST /mcp with the same service token", async () => {
    const app = new TerrenoApp({
      mcpServiceTokens: true,
      skipListen: true,
      userModel: typedUserModel,
    })
      .register(noteRouter())
      .build();

    const agent = await authAsUser(app, "notAdmin");
    const created = await agent.post("/mcp/service-tokens").send({name: "Perplexity probe"});
    const mcpToken = created.body.data.token as string;
    const jwtListed = await agent
      .post("/mcp")
      .set("accept", "application/json, text/event-stream")
      .send({id: 2, jsonrpc: "2.0", method: "tools/list", params: {}});

    const probe = await supertest(app)
      .get("/mcp")
      .set("Authorization", `Bearer ${mcpToken}`)
      .set("accept", "application/json, text/event-stream");
    const initialized = await supertest(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${mcpToken}`)
      .set("accept", "application/json, text/event-stream")
      .send({
        id: 1,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: {name: "perplexity", version: "0"},
          protocolVersion: "2024-11-05",
        },
      });
    const listed = await supertest(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${mcpToken}`)
      .set("accept", "application/json, text/event-stream")
      .send({id: 2, jsonrpc: "2.0", method: "tools/list", params: {}});

    assert.notEqual(probe.status, 401);
    assert.include(initialized.text, "terreno-api-mcp");
    assert.include(listed.text, "tokenmcpnotes_list");
    assert.include(jwtListed.text, "tokenmcpnotes_list");
  });
});
