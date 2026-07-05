import {describe, expect, it} from "bun:test";
import express from "express";

import {authAsUser} from "./authAsUser";
import {getBaseServer} from "./getBaseServer";

describe("authAsUser", () => {
  it("returns an agent with Bearer authorization after login", async () => {
    const app = getBaseServer();
    app.use(express.json());
    app.post("/auth/login", (req, res) => {
      const {email, password} = req.body as {email?: string; password?: string};
      if (email === "user@test.com" && password === "secret") {
        res.json({data: {token: "test-token-123"}});
        return;
      }
      res.status(401).json({error: "Invalid credentials"});
    });
    app.get("/protected", (req, res) => {
      res.json({authorization: req.headers.authorization});
    });

    const agent = await authAsUser(app, {email: "user@test.com", password: "secret"});
    const response = await agent.get("/protected").expect(200);

    expect(response.body.authorization).toBe("Bearer test-token-123");
  });

  it("throws when the login response does not include a token", async () => {
    const app = getBaseServer();
    app.use(express.json());
    app.post("/auth/login", (_req, res) => {
      res.json({data: {}});
    });

    await expect(
      authAsUser(app, {email: "user@test.com", password: "secret"})
    ).rejects.toThrow('authAsUser: expected string token at response path "data.token"');
  });
});
