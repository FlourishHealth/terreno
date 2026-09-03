import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import type express from "express";
import {DateTime} from "luxon";
import mongoose from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {type UserModel as AuthUserModel, addAuthRoutes, setupAuth} from "../auth";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "../errors";
import {McpServiceToken} from "../models/mcpServiceToken";
import {TerrenoApp} from "../terrenoApp";
import {authAsUser, getBaseServer, setupDb, UserModel} from "../tests";
import {addMcpServiceTokenRoutes, MAX_ACTIVE_MCP_SERVICE_TOKENS} from "./serviceTokens";

const PUBLIC_MCP_URL = "https://api.example.com";

const assertNoSecrets = (body: unknown): void => {
  const serialized = JSON.stringify(body);
  assert.notInclude(serialized, "tokenHash");
  if (typeof body === "object" && body !== null && "data" in body) {
    const data = (body as {data: unknown}).data;
    if (Array.isArray(data)) {
      for (const item of data) {
        assert.notProperty(item, "token");
        assert.notProperty(item, "tokenHash");
      }
    }
  }
};

describe("MCP service token routes", () => {
  let app: express.Application;
  let agent: TestAgent;
  let adminAgent: TestAgent;
  let notAdminId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const users = await setupDb();
    notAdminId = users[1]._id as mongoose.Types.ObjectId;
    await McpServiceToken.deleteMany({});

    app = getBaseServer();
    setupAuth(app, UserModel as never);
    addAuthRoutes(app, UserModel as never);
    addMcpServiceTokenRoutes(app, {publicMcpUrl: PUBLIC_MCP_URL});
    app.use(apiUnauthorizedMiddleware);
    app.use(apiErrorMiddleware);

    agent = await authAsUser(app, "notAdmin");
    adminAgent = await authAsUser(app, "admin");
  });

  it("creates a token once and returns mcpUrl with the plaintext", async () => {
    const res = await agent.post("/mcp/service-tokens").send({name: "Perplexity laptop"});

    assert.equal(res.status, 200);
    assert.match(res.body.data.token, /^mcp_[0-9a-f]{64}$/);
    assert.equal(res.body.data.name, "Perplexity laptop");
    assert.equal(res.body.data.mcpUrl, `${PUBLIC_MCP_URL}/mcp`);
    assert.equal(res.body.data.tokenPrefix, res.body.data.token.slice(4, 12));
    assert.isUndefined(res.body.data.tokenHash);

    const stored = await McpServiceToken.findExactlyOne({_id: res.body.data.id});
    assert.notEqual(stored.tokenHash, res.body.data.token);
    assert.notInclude(JSON.stringify(stored.toJSON()), res.body.data.token);
  });

  it("lists only the caller's tokens without plaintext or hash", async () => {
    const mine = await agent.post("/mcp/service-tokens").send({name: "Mine"});
    await adminAgent.post("/mcp/service-tokens").send({name: "Admin token"});

    const res = await agent.get("/mcp/service-tokens");

    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.more, false);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].id, mine.body.data.id);
    assert.equal(res.body.data[0].name, "Mine");
    assertNoSecrets(res.body);
  });

  it("accepts an optional future ISO expiresAt on create", async () => {
    const expiresAt = DateTime.now().plus({day: 1}).toUTC().toISO();
    const res = await agent.post("/mcp/service-tokens").send({
      expiresAt,
      name: "Expiring",
    });

    assert.equal(res.status, 200);
    assert.equal(DateTime.fromISO(res.body.data.expiresAt).toUTC().toISO(), expiresAt);
  });

  it("revokes an owned token and hides it from other users", async () => {
    const created = await agent.post("/mcp/service-tokens").send({name: "To revoke"});
    const tokenId = created.body.data.id as string;

    const otherDelete = await adminAgent.delete(`/mcp/service-tokens/${tokenId}`);
    assert.equal(otherDelete.status, 404);

    const revoked = await agent.delete(`/mcp/service-tokens/${tokenId}`);
    assert.equal(revoked.status, 200);
    assert.equal(revoked.body.data.id, tokenId);
    assert.isString(revoked.body.data.revokedAt);

    const listed = await agent.get("/mcp/service-tokens");
    assert.equal(listed.body.data[0].id, tokenId);
    assert.isString(listed.body.data[0].revokedAt);

    const again = await agent.delete(`/mcp/service-tokens/${tokenId}`);
    assert.equal(again.status, 404);
  });

  it("rejects a create once the caller already has 10 active tokens", async () => {
    for (let index = 0; index < MAX_ACTIVE_MCP_SERVICE_TOKENS; index += 1) {
      await McpServiceToken.issueFor({_id: notAdminId}, {name: `Token ${index}`});
    }

    const res = await agent.post("/mcp/service-tokens").send({name: "One too many"});

    assert.equal(res.status, 400);
    assert.match(res.body.title, /Maximum of 10 active MCP service tokens/);
    assert.equal(await McpServiceToken.countActiveForUser(notAdminId), 10);
  });

  it("rejects mcp_ bearer tokens on self-serve routes", async () => {
    const created = await agent.post("/mcp/service-tokens").send({name: "Connector"});
    const mcpToken = created.body.data.token as string;

    const listed = await supertest(app)
      .get("/mcp/service-tokens")
      .set("Authorization", `Bearer ${mcpToken}`);
    const minted = await supertest(app)
      .post("/mcp/service-tokens")
      .set("Authorization", `Bearer ${mcpToken}`)
      .send({name: "Nested"});
    const revoked = await supertest(app)
      .delete(`/mcp/service-tokens/${created.body.data.id}`)
      .set("Authorization", `Bearer ${mcpToken}`);

    assert.equal(listed.status, 401);
    assert.equal(minted.status, 401);
    assert.equal(revoked.status, 401);
  });

  it("requires a session or JWT", async () => {
    const res = await supertest(app).get("/mcp/service-tokens");
    assert.equal(res.status, 401);
  });

  it("returns 404 for an unknown token id", async () => {
    const res = await agent.delete(
      `/mcp/service-tokens/${new mongoose.Types.ObjectId().toString()}`
    );
    assert.equal(res.status, 404);
  });
});

describe("MCP service token OpenAPI", () => {
  it("documents create, list, and revoke on /openapi.json", async () => {
    const app = new TerrenoApp({
      configureApp: (router, options) => {
        addMcpServiceTokenRoutes(router, {
          openApi: options?.openApi,
          publicMcpUrl: PUBLIC_MCP_URL,
        });
      },
      skipListen: true,
      userModel: UserModel as unknown as AuthUserModel,
    }).build();

    const res = await supertest(app).get("/openapi.json");

    assert.equal(res.status, 200);
    assert.equal(res.body.paths["/mcp/service-tokens"].post.operationId, "createMcpServiceToken");
    assert.equal(res.body.paths["/mcp/service-tokens"].get.operationId, "listMcpServiceTokens");
    assert.equal(
      res.body.paths["/mcp/service-tokens/{id}"].delete.operationId,
      "revokeMcpServiceToken"
    );
    assert.equal(
      res.body.paths["/mcp/service-tokens"].post.responses["200"].content["application/json"].schema
        .properties.data.type,
      "object"
    );
  });
});
