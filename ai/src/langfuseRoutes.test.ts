import {beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

mock.module("./langfuseClient", () => ({
  getLangfuseClient: () => ({
    api: {
      promptsList: async () => ({data: [], meta: {limit: 20, page: 1, total: 0, totalPages: 0}}),
    },
    fetchTrace: async () => ({data: null}),
    fetchTraces: async () => ({data: [], meta: {limit: 20, page: 1, total: 0, totalPages: 0}}),
    flushAsync: async () => {},
    score: () => {},
  }),
}));

const {addPromptRoutes} = await import("./langfuseRoutesPrompts");
const {addTraceRoutes} = await import("./langfuseRoutesTraces");
const {addPlaygroundRoutes} = await import("./langfuseRoutesPlayground");
const {addEvaluationRoutes} = await import("./langfuseRoutesEvaluations");

const userSchema = new mongoose.Schema({
  admin: {default: false, type: Boolean},
  email: {index: true, type: String},
  name: String,
});
userSchema.plugin(passportLocalMongoose as Parameters<typeof userSchema.plugin>[0], {
  usernameField: "email",
});
userSchema.plugin(createdUpdatedPlugin);

const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const authAsUser = async (
  appInstance: Parameters<typeof supertest>[0],
  type: "admin" | "notAdmin"
) => {
  const email = type === "admin" ? "lf-admin@example.com" : "lf-user@example.com";
  const password = type === "admin" ? "adminPass123" : "userPass123";
  const agent = supertest.agent(appInstance);
  const res = await agent.post("/auth/login").send({email, password}).expect(200);
  await agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
};

let app: ReturnType<typeof setupServer>;

describe("Langfuse routes", () => {
  beforeAll(async () => {
    await UserModel.deleteMany({email: {$in: ["lf-admin@example.com", "lf-user@example.com"]}});

    const admin = await UserModel.create({
      admin: true,
      email: "lf-admin@example.com",
      name: "LF Admin",
    });
    await (admin as {setPassword: (p: string) => Promise<void>}).setPassword("adminPass123");
    await admin.save();

    const user = await UserModel.create({email: "lf-user@example.com", name: "LF User"});
    await (user as {setPassword: (p: string) => Promise<void>}).setPassword("userPass123");
    await user.save();
  });

  beforeEach(() => {
    app = setupServer({
      addRoutes: (router) => {
        addPromptRoutes(router, "/admin/langfuse");
        addTraceRoutes(router, "/admin/langfuse");
        addPlaygroundRoutes(router, "/admin/langfuse");
        addEvaluationRoutes(router, "/admin/langfuse", []);
      },
      skipListen: true,
      userModel: UserModel as Parameters<typeof setupServer>[0]["userModel"],
    });
  });

  describe("prompt routes", () => {
    it("returns 403 for non-admin users", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.get("/admin/langfuse/prompts");
      expect(res.status).toBe(403);
    });

    it("returns non-403 for admin users", async () => {
      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/admin/langfuse/prompts");
      expect(res.status).not.toBe(403);
    });
  });

  describe("trace routes", () => {
    it("returns 403 for non-admin users", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.get("/admin/langfuse/traces");
      expect(res.status).toBe(403);
    });

    it("returns non-403 for admin users", async () => {
      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/admin/langfuse/traces");
      expect(res.status).not.toBe(403);
    });
  });

  describe("playground routes", () => {
    it("returns 403 for non-admin users", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.post("/admin/langfuse/playground").send({promptName: "test"});
      expect(res.status).toBe(403);
    });

    it("returns 400 for admin users when promptName is missing", async () => {
      const agent = await authAsUser(app, "admin");
      const res = await agent.post("/admin/langfuse/playground").send({});
      expect(res.status).not.toBe(403);
    });
  });

  describe("evaluation routes", () => {
    it("returns 403 for non-admin users on config", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent.get("/admin/langfuse/evaluations/config");
      expect(res.status).toBe(403);
    });

    it("returns non-403 for admin users on config", async () => {
      const agent = await authAsUser(app, "admin");
      const res = await agent.get("/admin/langfuse/evaluations/config");
      expect(res.status).not.toBe(403);
    });

    it("returns 403 for non-admin users on submit", async () => {
      const agent = await authAsUser(app, "notAdmin");
      const res = await agent
        .post("/admin/langfuse/evaluations")
        .send({name: "score", traceId: "t1", value: 1});
      expect(res.status).toBe(403);
    });
  });
});
