import {describe, expect, it} from "bun:test";
import type express from "express";
import supertest from "supertest";

import {start} from "./server";

describe("OpenAPI spec generation", () => {
  let app: express.Application;

  it("generates a valid openapi.json", async () => {
    app = await start(true);
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.openapi).toBe("3.0.0");
    expect(res.body.info).toBeDefined();
    expect(res.body.paths).toBeDefined();
  });

  it("includes admin todo routes", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.paths["/admin/todos/"]).toBeDefined();
    expect(res.body.paths["/admin/todos/{id}"]).toBeDefined();
    expect(res.body.paths["/admin/todos/"].get).toBeDefined();
    expect(res.body.paths["/admin/todos/"].post).toBeDefined();
    expect(res.body.paths["/admin/todos/{id}"].get).toBeDefined();
    expect(res.body.paths["/admin/todos/{id}"].patch).toBeDefined();
    expect(res.body.paths["/admin/todos/{id}"].delete).toBeDefined();
  });

  it("includes admin user routes", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.paths["/admin/users/"]).toBeDefined();
    expect(res.body.paths["/admin/users/{id}"]).toBeDefined();
  });

  it("includes feature flag routes", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.paths["/feature-flags/flags/"]).toBeDefined();
    expect(res.body.paths["/feature-flags/flags/{id}"]).toBeDefined();
    expect(res.body.paths["/feature-flags/flags/"].get).toBeDefined();
    expect(res.body.paths["/feature-flags/flags/"].post).toBeDefined();
  });

  it("includes GPT routes", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.paths["/gpt/prompt"]).toBeDefined();
    expect(res.body.paths["/gpt/prompt"].post).toBeDefined();
    expect(res.body.paths["/gpt/remix"]).toBeDefined();
    expect(res.body.paths["/gpt/remix"].post).toBeDefined();
  });

  it("includes settings routes", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.paths["/settings/gcs"]).toBeDefined();
  });

  it("has CRUD operations on admin todo routes", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    const todoList = res.body.paths["/admin/todos/"];
    const todoDetail = res.body.paths["/admin/todos/{id}"];

    // List should have pagination parameters
    const listParams = todoList.get.parameters;
    const paramNames = listParams.map((p: {name: string}) => p.name);
    expect(paramNames).toContain("limit");
    expect(paramNames).toContain("page");

    // Create should have a request body
    expect(todoList.post.requestBody).toBeDefined();

    // Detail endpoints should have id path parameter
    expect(todoDetail.get).toBeDefined();
    expect(todoDetail.patch).toBeDefined();
    expect(todoDetail.delete).toBeDefined();
  });

  it("has ETag caching on openapi.json", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);
    expect(res.headers.etag).toBeDefined();

    // Second request with matching ETag returns 304
    const secondRes = await server
      .get("/openapi.json")
      .set("If-None-Match", res.headers.etag)
      .expect(304);
    expect(secondRes.body).toEqual({});
  });

  it("includes APIError schema in components", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body.components?.schemas?.APIError).toBeDefined();
  });

  it("matches snapshot", async () => {
    const server = supertest(app);
    const res = await server.get("/openapi.json").expect(200);

    expect(res.body).toMatchSnapshot();
  });
});
