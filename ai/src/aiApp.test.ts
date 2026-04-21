import {beforeAll, describe, expect, it, mock} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

import {AiApp} from "./aiApp";

const userSchema = new mongoose.Schema({
  admin: {default: false, type: Boolean},
  email: {index: true, type: String},
  name: String,
});
userSchema.plugin(passportLocalMongoose as any, {usernameField: "email"});
userSchema.plugin(createdUpdatedPlugin);
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const createMockModel = () => ({
  doGenerate: mock(async () => ({
    content: [{text: "ok", type: "text" as const}],
    finishReason: "stop" as const,
    usage: {inputTokens: 1, outputTokens: 1},
  })),
  doStream: mock(async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({
          finishReason: "stop" as const,
          type: "finish" as const,
          usage: {inputTokens: 1, outputTokens: 1},
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

describe("AiApp", () => {
  beforeAll(async () => {
    await UserModel.deleteMany({});
    const user = await UserModel.create({email: "aiapp@example.com", name: "User"});
    await (user as any).setPassword("password");
    await user.save();
  });

  const authAsUser = async (app: any) => {
    const agent = supertest.agent(app);
    const res = await agent
      .post("/auth/login")
      .send({email: "aiapp@example.com", password: "password"})
      .expect(200);
    await agent.set("authorization", `Bearer ${res.body.data.token}`);
    return agent;
  };

  it("registers gpt and project routes by default", async () => {
    const {AIService} = await import("./service/aiService");
    const aiService = new AIService({model: createMockModel() as any});
    const plugin = new AiApp({aiService});
    const app = setupServer({
      addRoutes: (router) => plugin.register(router as any),
      skipListen: true,
      userModel: UserModel as any,
    });

    const agent = await authAsUser(app);
    const tools = await agent.get("/gpt/tools");
    expect(tools.status).toBe(200);
    const histories = await agent.get("/gpt/histories");
    expect(histories.status).toBe(200);
    const projects = await agent.get("/gpt/projects");
    expect(projects.status).toBe(200);
  });

  it("registers file routes only when fileStorageService and gcsBucket are provided", async () => {
    const fileStorageService: any = {
      delete: mock(async () => {}),
      getSignedUrl: mock(async () => "https://gcs/signed"),
      uploadFile: mock(async () => "https://gcs/file"),
    };
    const plugin = new AiApp({fileStorageService, gcsBucket: "test-bucket"});
    const app = setupServer({
      addRoutes: (router) => plugin.register(router as any),
      skipListen: true,
      userModel: UserModel as any,
    });
    const agent = await authAsUser(app);
    // Unauthenticated access to upload route: ensure it exists (returns 401, not 404).
    const upload = await supertest(app).post("/files/upload");
    expect(upload.status).not.toBe(404);
  });

  it("skips file routes when only fileStorageService is provided", async () => {
    const fileStorageService: any = {uploadFile: mock(async () => "x")};
    const plugin = new AiApp({fileStorageService});
    const app = setupServer({
      addRoutes: (router) => plugin.register(router as any),
      skipListen: true,
      userModel: UserModel as any,
    });
    const upload = await supertest(app).post("/files/upload");
    expect(upload.status).toBe(404);
  });

  it("registers mcp routes when mcpService is provided", async () => {
    const mcpService: any = {
      getMCPStatus: mock(() => []),
      getTools: mock(async () => ({})),
      reconnect: mock(async () => {}),
    };
    const plugin = new AiApp({mcpService});
    const app = setupServer({
      addRoutes: (router) => plugin.register(router as any),
      skipListen: true,
      userModel: UserModel as any,
    });
    const agent = await authAsUser(app);
    const servers = await agent.get("/mcp/servers");
    expect(servers.status).not.toBe(404);
  });
});
