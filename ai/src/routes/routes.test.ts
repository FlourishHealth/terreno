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
import {addGptRoutes} from "./gpt";
import {addGptHistoryRoutes} from "./gptHistories";

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

// Create mock AI model
const createMockModel = () => ({
  doGenerate: mock(async () => ({
    finishReason: "stop" as const,
    rawCall: {rawPrompt: "", rawSettings: {}},
    text: "AI response",
    usage: {completionTokens: 10, promptTokens: 5},
  })),
  doStream: mock(async () => ({
    rawCall: {rawPrompt: "", rawSettings: {}},
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({
          finishReason: undefined,
          textDelta: "AI ",
          type: "text-delta" as const,
        });
        controller.enqueue({
          finishReason: undefined,
          textDelta: "response",
          type: "text-delta" as const,
        });
        controller.enqueue({
          finishReason: "stop" as const,
          logprobs: undefined,
          type: "finish" as const,
          usage: {completionTokens: 10, promptTokens: 5},
        });
        controller.close();
      },
    }),
  })),
  modelId: "mock-model",
  provider: "mock-provider",
  specificationVersion: "v1" as const,
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
  });
});
