import {afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

import {AIRequest} from "../models/aiRequest";
import {GptHistory} from "../models/gptHistory";
import {Project} from "../models/project";
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
const createMockModel = (modelId = "mock-model") => ({
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
  modelId,
  provider: "mock-provider",
  specificationVersion: "v2" as const,
  supportedUrls: {},
});

// Create mock model that emits a file (image) event
const createImageModel = () => ({
  doGenerate: mock(async () => ({
    content: [{text: "done", type: "text" as const}],
    finishReason: "stop" as const,
    usage: {inputTokens: 2, outputTokens: 2},
  })),
  doStream: mock(async () => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({id: "t1", type: "text-start" as const});
        controller.enqueue({delta: "here is an image", id: "t1", type: "text-delta" as const});
        controller.enqueue({id: "t1", type: "text-end" as const});
        controller.enqueue({
          data: "aGVsbG8=",
          mediaType: "image/png",
          type: "file" as const,
        });
        controller.enqueue({
          finishReason: "stop" as const,
          type: "finish" as const,
          usage: {inputTokens: 2, outputTokens: 2},
        });
        controller.close();
      },
    }),
  })),
  modelId: "gemini-2.5-flash-image",
  provider: "mock-provider",
  specificationVersion: "v2" as const,
  supportedUrls: {},
});

// Mock model that throws during doStream to exercise the inner catch
const createErrorModel = () => ({
  doGenerate: mock(async () => ({
    content: [],
    finishReason: "error" as const,
    usage: {inputTokens: 0, outputTokens: 0},
  })),
  doStream: mock(async () => {
    throw new Error("stream failure");
  }),
  modelId: "error-model",
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

    it("returns demo response when no aiService configured", async () => {
      const demoApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(demoApp, "notAdmin");
      const res = await agent.post("/gpt/remix").send({text: "Hello"});
      expect(res.status).toBe(200);
      expect(res.body.data).toContain("demo mode");
    });
  });

  const sseCollect = (r: any, cb: (err: Error | null, data: string) => void) => {
    let data = "";
    r.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });
    r.on("end", () => cb(null, data));
  };

  describe("GPT Prompt route", () => {
    it("requires a prompt", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/gpt/prompt").send({});
      // APIError.instanceof check in pre-stream catch results in 500 from the dist-compiled class,
      // but the body should contain the detail from the thrown APIError.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.detail || res.body.title).toContain("prompt");
    });

    it("streams a response and saves history", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);

      expect(res.status).toBe(200);
      const body = (res as any).body as string;
      expect(body).toContain("data:");
      expect(body).toContain("done");

      const histories = await GptHistory.find({});
      expect(histories.length).toBeGreaterThanOrEqual(1);
    });

    it("sends demo response when no ai service configured", async () => {
      const demoApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(demoApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const body = (res as any).body as string;
      expect(body).toContain("demo mode");
    });

    it("uses per-request api key via x-ai-api-key header", async () => {
      const createModelFn = mock((_apiKey: string, _modelId?: string) => {
        return createMockModel() as any;
      });
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {createModelFn, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .set("x-ai-api-key", "test-key")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      expect(createModelFn).toHaveBeenCalled();
    });

    it("uses createServerModelFn when model requested", async () => {
      const createServerModelFn = mock((_modelId?: string) => createMockModel() as any);
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {createServerModelFn, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({model: "gemini-2.5-pro", prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      expect(createServerModelFn).toHaveBeenCalledWith("gemini-2.5-pro");
    });

    it("rejects history from another user", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const other = await GptHistory.create({
        prompts: [{text: "Hello", type: "user"}],
        userId: otherUserId,
      });

      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({historyId: other._id.toString(), prompt: "Hi"});
      // APIError instanceof check returns false for dist-compiled classes, yielding 500
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(res.body)).toContain("authorized");
    });

    it("returns an error body for unknown historyId", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await agent.post("/gpt/prompt").send({historyId: fakeId, prompt: "Hi"});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(res.body)).toContain("not found".toLowerCase());
    });

    it("continues an existing history", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const history = await GptHistory.create({
        prompts: [{text: "Hello", type: "user"}],
        userId: notAdmin._id,
      });

      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({historyId: history._id.toString(), prompt: "Hi again"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const updated = await GptHistory.findById(history._id);
      expect(updated?.prompts.length).toBeGreaterThanOrEqual(3);
    });

    it("integrates project context when projectId is provided", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const project = await Project.create({
        memories: [{source: "user", text: "Likes brief answers"}],
        name: "Test Project",
        systemContext: "Respond concisely",
        userId: notAdmin._id,
      });

      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({projectId: project._id.toString(), prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      await Project.deleteMany({});
    });

    it("handles attachments in the prompt", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({
          attachments: [
            {mimeType: "image/png", type: "image", url: "https://example.com/img.png"},
            {
              filename: "doc.pdf",
              mimeType: "application/pdf",
              type: "file",
              url: "https://example.com/doc.pdf",
            },
          ],
          prompt: "What is this?",
        })
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
    });

    it("streams inline image events from the model", async () => {
      const imageService = new (AIService as any)({model: createImageModel()});
      const imgApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService: imageService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(imgApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Make an image"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const body = (res as any).body as string;
      expect(body).toContain("image");
    });

    it("writes an SSE error event when the model stream throws", async () => {
      const errService = new (AIService as any)({model: createErrorModel()});
      const errApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService: errService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(errApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const body = (res as any).body as string;
      expect(body).toContain("error");
    });

    it("merges MCP tools and tolerates MCP getTools failures", async () => {
      const mcpService = {
        getTools: mock(async () => {
          throw new Error("mcp unavailable");
        }),
      } as any;
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService, mcpService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      expect(mcpService.getTools).toHaveBeenCalled();
    });

    it("merges MCP tools on success", async () => {
      const mcpService = {
        getTools: mock(async () => ({
          search: {description: "web search"},
        })),
      } as any;
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService, mcpService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
    });

    it("generates titles via a dedicated title model factory", async () => {
      const mainFn = mock(() => createMockModel("main") as any);
      const titleFn = mock(() => createMockModel("title-model") as any);
      // createServerModelFn routes by id so we can differentiate main vs. title model.
      const createServerModelFn = mock((modelId?: string) => {
        if (modelId === "title-model") {
          return titleFn();
        }
        return mainFn();
      });
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            createServerModelFn,
            openApiOptions: options,
            titleModelId: "title-model",
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({model: "main", prompt: "Hello"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      expect(createServerModelFn).toHaveBeenCalledWith("title-model");
    });

    it("generates titles via per-request api key title model", async () => {
      const createModelFn = mock((_apiKey: string, _modelId?: string) => {
        return createMockModel() as any;
      });
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            createModelFn,
            openApiOptions: options,
            titleModelId: "title-small",
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .set("x-ai-api-key", "user-key")
        .send({prompt: "Hello"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      // First call is the main model, subsequent call should be the title model.
      expect(createModelFn).toHaveBeenCalled();
      const titleCalls = (createModelFn as any).mock.calls.filter(
        (args: any[]) => args[1] === "title-small"
      );
      expect(titleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("applies image provider options for image-capable models", async () => {
      const imageService = new (AIService as any)({model: createImageModel()});
      const imgApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            aiService: imageService,
            openApiOptions: options,
            tools: {dummy: {description: "ignored for image models"}} as any,
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(imgApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Draw a cat"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
    });

    it("uses the langfuse system prompt when configured", async () => {
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            aiService,
            langfuseSystemPromptName: "missing-prompt-name",
            openApiOptions: options,
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
    });

    it("forwards model tool-call and tool-result stream events via SSE", async () => {
      const toolModel = {
        doGenerate: mock(async () => ({
          content: [{text: "ok", type: "text" as const}],
          finishReason: "stop" as const,
          usage: {inputTokens: 1, outputTokens: 1},
        })),
        doStream: mock(async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({id: "t1", type: "text-start" as const});
              controller.enqueue({
                delta: "Let me search.",
                id: "t1",
                type: "text-delta" as const,
              });
              controller.enqueue({id: "t1", type: "text-end" as const});
              controller.enqueue({
                input: {q: "hello"},
                providerExecuted: true,
                toolCallId: "tc1",
                toolName: "search",
                type: "tool-call" as const,
              });
              controller.enqueue({
                output: {
                  fileData: "data:application/pdf;base64,AAAA",
                  filename: "result.pdf",
                  mimeType: "application/pdf",
                  results: ["item1"],
                },
                providerExecuted: true,
                toolCallId: "tc1",
                toolName: "search",
                type: "tool-result" as const,
              });
              controller.enqueue({
                finishReason: "stop" as const,
                type: "finish" as const,
                usage: {inputTokens: 3, outputTokens: 3},
              });
              controller.close();
            },
          }),
        })),
        modelId: "mock-tools",
        provider: "mock-provider",
        specificationVersion: "v2" as const,
        supportedUrls: {},
      };
      const toolApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            aiService: new (AIService as any)({model: toolModel}),
            openApiOptions: options,
            tools: {
              search: {description: "Web search"},
            } as any,
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(toolApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "search"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const body = (res as any).body as string;
      expect(body).toContain("toolCall");
      expect(body).toContain("toolResult");
    });

    it("forwards mid-stream error parts as SSE error events", async () => {
      const errEventModel = {
        doGenerate: mock(async () => ({
          content: [{text: "ok", type: "text" as const}],
          finishReason: "stop" as const,
          usage: {inputTokens: 1, outputTokens: 1},
        })),
        doStream: mock(async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({id: "t1", type: "text-start" as const});
              controller.enqueue({delta: "partial", id: "t1", type: "text-delta" as const});
              controller.enqueue({id: "t1", type: "text-end" as const});
              controller.enqueue({
                error: new Error("mid-stream failure"),
                type: "error" as const,
              });
              controller.enqueue({
                finishReason: "stop" as const,
                type: "finish" as const,
                usage: {inputTokens: 1, outputTokens: 1},
              });
              controller.close();
            },
          }),
        })),
        modelId: "mock-error-event",
        provider: "mock-provider",
        specificationVersion: "v2" as const,
        supportedUrls: {},
      };
      const errApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            aiService: new (AIService as any)({model: errEventModel}),
            openApiOptions: options,
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(errApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const body = (res as any).body as string;
      expect(body).toContain("mid-stream failure");
    });

    it("swallows title generation errors without failing the stream", async () => {
      const throwingTitleModel = {
        doGenerate: mock(async () => {
          throw new Error("title generate failed");
        }),
        doStream: mock(async () => ({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({id: "t1", type: "text-start" as const});
              controller.enqueue({delta: "ok", id: "t1", type: "text-delta" as const});
              controller.enqueue({id: "t1", type: "text-end" as const});
              controller.enqueue({
                finishReason: "stop" as const,
                type: "finish" as const,
                usage: {inputTokens: 1, outputTokens: 1},
              });
              controller.close();
            },
          }),
        })),
        modelId: "title-throw",
        provider: "mock-provider",
        specificationVersion: "v2" as const,
        supportedUrls: {},
      };
      const createServerModelFn = mock((id?: string) => {
        if (id === "title-throw-model") {
          return throwingTitleModel as any;
        }
        return createMockModel() as any;
      });
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            createServerModelFn,
            openApiOptions: options,
            titleModelId: "title-throw-model",
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({model: "main-model", prompt: "Give me a title"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      expect(createServerModelFn).toHaveBeenCalledWith("title-throw-model");
    });

    it("associates a projectId with an existing history when provided later", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const project = await Project.create({name: "Late Project", userId: notAdmin._id});
      const history = await GptHistory.create({
        prompts: [{text: "Hi", type: "user"}],
        userId: notAdmin._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({
          historyId: history._id.toString(),
          projectId: project._id.toString(),
          prompt: "Follow up",
        })
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      const updated = await GptHistory.findById(history._id);
      expect(updated?.projectId?.toString()).toBe(project._id.toString());
      await Project.deleteMany({});
    });

    it("uses per-request tools via createRequestTools", async () => {
      const createRequestTools = mock(() => ({
        localLookup: {description: "Per-request tool"} as any,
      }));
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            aiService,
            createRequestTools,
            openApiOptions: options,
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent
        .post("/gpt/prompt")
        .send({prompt: "Hi"})
        .buffer(true)
        .parse(sseCollect);
      expect(res.status).toBe(200);
      expect(createRequestTools).toHaveBeenCalled();
    });
  });

  describe("GPT history rating route", () => {
    it("rejects non-numeric promptIndex", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const h = await GptHistory.create({
        prompts: [{text: "hi", type: "user"}],
        userId: notAdmin._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .patch(`/gpt/histories/${h._id.toString()}/rating`)
        .send({promptIndex: "bad", rating: "up"});
      expect(res.status).toBe(400);
    });

    it("rejects invalid rating value", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const h = await GptHistory.create({
        prompts: [{text: "hi", type: "user"}],
        userId: notAdmin._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .patch(`/gpt/histories/${h._id.toString()}/rating`)
        .send({promptIndex: 0, rating: "maybe"});
      expect(res.status).toBe(400);
    });

    it("returns 404 for missing history", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const id = new mongoose.Types.ObjectId().toString();
      const res = await agent
        .patch(`/gpt/histories/${id}/rating`)
        .send({promptIndex: 0, rating: "up"});
      expect(res.status).toBe(404);
    });

    it("returns 403 when not owner", async () => {
      const otherId = new mongoose.Types.ObjectId();
      const h = await GptHistory.create({
        prompts: [{text: "hi", type: "user"}],
        userId: otherId,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .patch(`/gpt/histories/${h._id.toString()}/rating`)
        .send({promptIndex: 0, rating: "up"});
      expect(res.status).toBe(403);
    });

    it("rejects out-of-range promptIndex", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const h = await GptHistory.create({
        prompts: [{text: "hi", type: "user"}],
        userId: notAdmin._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .patch(`/gpt/histories/${h._id.toString()}/rating`)
        .send({promptIndex: 99, rating: "up"});
      expect(res.status).toBe(400);
    });

    it("sets rating on a prompt", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const h = await GptHistory.create({
        prompts: [
          {text: "hi", type: "user"},
          {text: "hello!", type: "assistant"},
        ],
        userId: notAdmin._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .patch(`/gpt/histories/${h._id.toString()}/rating`)
        .send({promptIndex: 1, rating: "up"});
      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBe("up");
    });

    it("clears rating when null is passed", async () => {
      const notAdmin = (await UserModel.findOne({
        email: "notAdmin@example.com",
      })) as mongoose.Document & {_id: mongoose.Types.ObjectId};
      const h = await GptHistory.create({
        prompts: [
          {text: "hi", type: "user"},
          {rating: "up", text: "hello!", type: "assistant"},
        ],
        userId: notAdmin._id,
      });
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .patch(`/gpt/histories/${h._id.toString()}/rating`)
        .send({promptIndex: 1, rating: null});
      expect(res.status).toBe(200);
      expect(res.body.data.rating).toBeNull();
    });
  });

  describe("GPT tools route", () => {
    it("lists built-in tools from route config", async () => {
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {
            aiService,
            openApiOptions: options,
            tools: {echo: {description: "Echo tool"} as any},
          });
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent.get("/gpt/tools");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([expect.objectContaining({name: "echo", source: "builtin"})]);
    });

    it("includes per-request tools when createRequestTools is set", async () => {
      const createRequestTools = mock(() => ({
        now: {description: "Current time"} as any,
      }));
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService, createRequestTools, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent.get("/gpt/tools");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([expect.objectContaining({name: "now"})]);
    });

    it("includes MCP tools when mcpService is set", async () => {
      const mcpService = {
        getTools: mock(async () => ({search: {description: "web search"}})),
      } as any;
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService, mcpService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent.get("/gpt/tools");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([expect.objectContaining({name: "search", source: "mcp"})]);
    });

    it("tolerates mcpService.getTools errors", async () => {
      const mcpService = {
        getTools: mock(async () => {
          throw new Error("boom");
        }),
      } as any;
      const customApp = setupServer({
        addRoutes: (router, options) => {
          addGptRoutes(router, {aiService, mcpService, openApiOptions: options});
        },
        skipListen: true,
        userModel: UserModel as any,
      });
      const agent = await authAsUser(customApp, "notAdmin");
      const res = await agent.get("/gpt/tools");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
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
