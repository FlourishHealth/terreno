import {beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

import type {MCPService} from "../service/mcpService";
import {addMcpRoutes} from "./mcp";

type PasswordedUser = {setPassword: (password: string) => Promise<void>};
type MockMcpService = Pick<MCPService, "getServerStatus" | "getTools" | "reconnectServer">;

const userSchema = new mongoose.Schema({
  admin: {default: false, type: Boolean},
  email: {index: true, type: String},
  name: String,
});
userSchema.plugin(
  passportLocalMongoose as unknown as (
    schema: mongoose.Schema,
    options: {usernameField: string}
  ) => void,
  {usernameField: "email"}
);
userSchema.plugin(createdUpdatedPlugin);
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const authAsUser = async (appInstance: express.Application, type: "admin" | "notAdmin") => {
  const email = type === "admin" ? "admin@example.com" : "notAdmin@example.com";
  const password = type === "admin" ? "securePassword" : "password";
  const agent = supertest.agent(appInstance);
  const res = await agent.post("/auth/login").send({email, password}).expect(200);
  await agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
};

describe("MCP Routes", () => {
  let app: express.Application;
  let mcpService: MockMcpService;

  beforeAll(async () => {
    await UserModel.deleteMany({});
    const admin = await UserModel.create({admin: true, email: "admin@example.com", name: "Admin"});
    await (admin as unknown as PasswordedUser).setPassword("securePassword");
    await admin.save();
    const user = await UserModel.create({email: "notAdmin@example.com", name: "User"});
    await (user as unknown as PasswordedUser).setPassword("password");
    await user.save();
  });

  beforeEach(() => {
    mcpService = {
      getServerStatus: mock(() => [{connected: true, name: "test-server"}]),
      getTools: mock(async () => ({
        search: {description: "Search", parameters: {type: "object"}},
      })),
      reconnectServer: mock(async () => true),
    } as unknown as MockMcpService;
    app = setupServer({
      addRoutes: (router, options) => {
        addMcpRoutes(router, {mcpService: mcpService as MCPService, openApiOptions: options});
      },
      skipListen: true,
      userModel: UserModel,
    });
  });

  describe("GET /mcp/servers", () => {
    it("returns 403 for non-admin users", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.get("/mcp/servers");
      expect(res.status).toBe(403);
    });

    it("returns server status for admin", async () => {
      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/mcp/servers");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([{connected: true, name: "test-server"}]);
    });
  });

  describe("GET /mcp/tools", () => {
    it("returns list of tools for authenticated user", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.get("/mcp/tools");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        expect.objectContaining({description: "Search", name: "search"}),
      ]);
    });

    it("requires authentication", async () => {
      const res = await supertest(app).get("/mcp/tools");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /mcp/servers/:name/reconnect", () => {
    it("returns 403 for non-admin users", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/mcp/servers/test-server/reconnect");
      expect(res.status).toBe(403);
    });

    it("reconnects the requested server for admin", async () => {
      const agent = await authAsUser(app, "admin");
      const res = await agent.post("/mcp/servers/test-server/reconnect");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({connected: true, name: "test-server"});
      expect(mcpService.reconnectServer as ReturnType<typeof mock>).toHaveBeenCalledWith(
        "test-server"
      );
    });

    it("returns connected=false when reconnect fails", async () => {
      mcpService.reconnectServer = mock(async () => false);
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addMcpRoutes(router, {mcpService: mcpService as MCPService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel,
      });
      const agent = await authAsUser(customApp, "admin");
      const res = await agent.post("/mcp/servers/unknown/reconnect");
      expect(res.status).toBe(200);
      expect(res.body.data.connected).toBe(false);
    });
  });
});
