import {beforeAll, beforeEach, describe, expect, it} from "bun:test";
import {createdUpdatedPlugin, setupServer} from "@terreno/api";
import type express from "express";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";

import {LangfuseApp} from "./langfuseApp";

type PasswordedUser = {setPassword: (password: string) => Promise<void>};

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

const buildApp = (plugin: LangfuseApp) =>
  setupServer({
    addRoutes: (router) => plugin.register(router as unknown as express.Application),
    skipListen: true,
    userModel: UserModel,
  });

describe("LangfuseApp", () => {
  beforeAll(async () => {
    await UserModel.deleteMany({});
    const u = await UserModel.create({email: "lf@example.com", name: "User"});
    await (u as unknown as PasswordedUser).setPassword("password");
    await u.save();
  });

  beforeEach(async () => {
    const {shutdownLangfuseClient} = await import("./langfuseClient");
    await shutdownLangfuseClient();
  });

  it("mounts admin routes at the default path", async () => {
    const plugin = new LangfuseApp({
      enableTracing: false,
      publicKey: "pk",
      secretKey: "sk",
    });
    const app = buildApp(plugin);
    const res = await supertest(app).get("/admin/langfuse/prompts");
    expect(res.status).not.toBe(404);
  });

  it("mounts admin routes at a custom path", async () => {
    const plugin = new LangfuseApp({
      adminPath: "/lf-admin",
      enableTracing: false,
      publicKey: "pk",
      secretKey: "sk",
    });
    const app = buildApp(plugin);
    const custom = await supertest(app).get("/lf-admin/prompts");
    expect(custom.status).not.toBe(404);
    const defaultPath = await supertest(app).get("/admin/langfuse/prompts");
    expect(defaultPath.status).toBe(404);
  });

  it("skips admin routes when enableAdminUI is false", async () => {
    const plugin = new LangfuseApp({
      enableAdminUI: false,
      enableTracing: false,
      publicKey: "pk",
      secretKey: "sk",
    });
    const app = buildApp(plugin);
    const res = await supertest(app).get("/admin/langfuse/prompts");
    expect(res.status).toBe(404);
  });

  it("registers evaluation routes when evaluation.enabled is true", async () => {
    const plugin = new LangfuseApp({
      enableTracing: false,
      evaluation: {enabled: true, scoringFunctions: []},
      publicKey: "pk",
      secretKey: "sk",
    });
    const app = buildApp(plugin);
    const res = await supertest(app).get("/admin/langfuse/evaluations/config");
    expect(res.status).not.toBe(404);
  });

  it("does not register evaluation routes when evaluation.enabled is false", async () => {
    const plugin = new LangfuseApp({
      enableTracing: false,
      evaluation: {enabled: false, scoringFunctions: []},
      publicKey: "pk",
      secretKey: "sk",
    });
    const app = buildApp(plugin);
    const res = await supertest(app).get("/admin/langfuse/evaluations/config");
    expect(res.status).toBe(404);
  });

  it("shuts down cleanly", async () => {
    const plugin = new LangfuseApp({
      enableTracing: false,
      publicKey: "pk",
      secretKey: "sk",
    });
    const app = buildApp(plugin);
    expect(app).toBeDefined();
    await plugin.shutdown();
  });

  it("invokes shutdown via the SIGTERM handler registered on register", async () => {
    const plugin = new LangfuseApp({
      enableTracing: false,
      publicKey: "pk",
      secretKey: "sk",
    });
    buildApp(plugin);
    // Find the SIGTERM listener that was added last by register() and invoke it directly.
    const listeners = process.listeners("SIGTERM");
    const last = listeners[listeners.length - 1] as (sig: NodeJS.Signals) => void;
    expect(typeof last).toBe("function");
    last("SIGTERM");
    process.removeListener("SIGTERM", last);
    // Give the fire-and-forget shutdown a tick to settle.
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
