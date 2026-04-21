import {afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

import {AIRequest} from "../models/aiRequest";
import {GptHistory} from "../models/gptHistory";
import {AIService} from "../service/aiService";
import {addAiRequestsExplorerRoutes} from "./aiRequestsExplorer";
import {addGptHistoryRoutes} from "./gptHistories";

// Mock langfuseVercelAi to avoid transitive langfuse SDK import in tests
mock.module("../langfuseVercelAi", () => ({
  createTelemetryConfig: () => ({functionId: "test", isEnabled: false}),
  preparePromptForAI: async () => ({config: {}, prompt: "test", telemetry: {isEnabled: false}}),
}));

const {addGptRoutes} = await import("./gpt");

// Test user schema
const userSchema = new mongoose.Schema({
  admin: {default: false, type: Boolean},
  email: {index: true, type: String},
  name: String,
});
userSchema.plugin(passportLocalMongoose as any, {
  usernameField: "email",
});
userSchema.plugin(createdUpdatedPlugin);

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// Create mock AI model (LanguageModelV2)
const createMockModel = () => ({
  doGenerate: mock(async () => ({
    content: [{text: "AI response", type: "text" as const}],
    finishReason: "stop" as const,
    usage: {inputTokens: 5, outputTokens: 10},
  })),
  doStream: mock(async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({id: "t1", type: "text-start" as const});
        controller.enqueue({delta: "AI ", id: "t1", type: "text-delta" as const});
        controller.enqueue({delta: "response", id: "t1", type: "text-delta" as const});
        controller.enqueue({id: "t1", type: "text-end" as const});
        controller.enqueue({
          finishReason: "stop" as const,
          type: "finish" as const,
          usage: {inputTokens: 5, outputTokens: 10},
        });
        controller.close();
      },
    }),
  })),
  modelId: "mock-model",
  provider: "mock-provider",
  specificationVersion: "v2" as const,
  supportedUrls: {},
});

let app: any;
let aiService: any;

const authAsUser = async (appInstance: express.Application, type: "admin" | "notAdmin") => {
  const email = type === "admin" ? "admin@example.com" : "notAdmin@example.com";
  const password = type === "admin" ? "securePassword" : "password";
  const agent = supertest.agent(appInstance);
  const res = await agent.post("/auth/login").send({email, password}).expect(200);
  await agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
};

describe("AI Routes", () => {
  beforeAll(async () => {
    // Clean up and create test users
    await UserModel.deleteMany({});
    await AIRequest.deleteMany({});
    await GptHistory.deleteMany({});

    const admin = await UserModel.create({admin: true, email: "admin@example.com", name: "Admin"});
    await (admin as any).setPassword("securePassword");
    await admin.save();

    const user = await UserModel.create({email: "notAdmin@example.com", name: "User"});
    await (user as any).setPassword("password");
    await user.save();
  });

  beforeEach(() => {
    const mockModel = createMockModel();
    aiService = new AIService({model: mockModel as any});

    app = setupServer({
      addRoutes: (router, options) => {
        addGptHistoryRoutes(router, options);
        addGptRoutes(router, {aiService, openApiOptions: options});
        addAiRequestsExplorerRoutes(router, {openApiOptions: options});
      },
      skipListen: true,
      userModel: UserModel as any,
    });
  });

  afterEach(async () => {
    await AIRequest.deleteMany({});
    await GptHistory.deleteMany({});
  });

  describe("GPT History routes", () => {
    it("should create a history", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/histories")
        .send({prompts: [{text: "Hello", type: "user"}]});

      expect(res.status).toBe(201);
      expect(res.body.data.prompts.length).toBe(1);
    });

    it("should list histories for the current user", async () => {
      const agent = await authAsUser(app, "notAdmin");
      await agent.post("/gpt/histories").send({prompts: [{text: "Hello", type: "user"}]});

      const res = await agent.get("/gpt/histories");
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GPT Remix route", () => {
    it("should remix text", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/gpt/remix").send({text: "Hello world"});

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should require text", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/gpt/remix").send({});

      expect(res.status).toBe(400);
    });
  });

  describe("AI Requests Explorer route", () => {
    it("should return 403 for non-admin users", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.get("/aiRequestsExplorer");

      expect(res.status).toBe(403);
    });

    it("should return data for admin users", async () => {
      // Create some test data
      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "test",
        requestType: "general",
        response: "response",
      });

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/aiRequestsExplorer");

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.page).toBe(1);
    });

    it("filters by requestType query parameter", async () => {
      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "remix prompt",
        requestType: "remix",
        response: "remix response",
      });
      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "general prompt",
        requestType: "general",
        response: "general response",
      });

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/aiRequestsExplorer?requestType=remix");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].requestType).toBe("remix");
    });

    it("filters by model query parameter", async () => {
      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "p1",
        requestType: "general",
        response: "r1",
      });
      await AIRequest.create({
        aiModel: "claude-3",
        prompt: "p2",
        requestType: "general",
        response: "r2",
      });

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/aiRequestsExplorer?model=claude-3");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.data[0].aiModel).toBe("claude-3");
    });

    it("filters by startDate query parameter", async () => {
      const old = await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "old",
        requestType: "general",
        response: "r",
      });
      await AIRequest.updateOne({_id: old._id}, {created: new Date("2020-01-01T00:00:00Z")});

      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "new",
        requestType: "general",
        response: "r",
      });

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/aiRequestsExplorer?startDate=2024-01-01T00:00:00Z");

      expect(res.status).toBe(200);
      // Only the recently-created record should be returned
      expect(res.body.total).toBe(1);
    });

    it("filters by endDate query parameter", async () => {
      const old = await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "old",
        requestType: "general",
        response: "r",
      });
      await AIRequest.updateOne({_id: old._id}, {created: new Date("2020-01-01T00:00:00Z")});

      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "new",
        requestType: "general",
        response: "r",
      });

      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/aiRequestsExplorer?endDate=2021-01-01T00:00:00Z");

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it("filters by startDate and endDate range", async () => {
      const a = await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "a",
        requestType: "general",
        response: "r",
      });
      await AIRequest.updateOne({_id: a._id}, {created: new Date("2022-06-01T00:00:00Z")});

      const b = await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "b",
        requestType: "general",
        response: "r",
      });
      await AIRequest.updateOne({_id: b._id}, {created: new Date("2020-01-01T00:00:00Z")});

      const agent = await authAsUser(app, "admin");
      const res = await agent.get(
        "/aiRequestsExplorer?startDate=2022-01-01T00:00:00Z&endDate=2023-01-01T00:00:00Z"
      );

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });
  });
});
