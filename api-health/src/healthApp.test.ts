import {describe, expect, it} from "bun:test";
import express from "express";
import supertest from "supertest";

import {HealthApp} from "./healthApp";

const createApp = (healthApp: HealthApp): express.Express => {
  const app = express();
  healthApp.register(app);
  return app;
};

describe("HealthApp", () => {
  it("returns healthy: true by default", async () => {
    const app = createApp(new HealthApp());
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body).toEqual({healthy: true});
  });

  it("uses custom path", async () => {
    const app = createApp(new HealthApp({path: "/status"}));
    await supertest(app).get("/health").expect(404);
    const res = await supertest(app).get("/status").expect(200);
    expect(res.body).toEqual({healthy: true});
  });

  it("does not register route when enabled is false", async () => {
    const app = createApp(new HealthApp({enabled: false}));
    await supertest(app).get("/health").expect(404);
  });

  it("calls custom check function returning healthy", async () => {
    const app = createApp(
      new HealthApp({
        check: () => ({
          details: {db: "connected"},
          healthy: true,
        }),
      })
    );
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body).toEqual({
      details: {db: "connected"},
      healthy: true,
    });
  });

  it("returns 503 when check function returns unhealthy", async () => {
    const app = createApp(
      new HealthApp({
        check: () => ({
          details: {db: "disconnected"},
          healthy: false,
        }),
      })
    );
    const res = await supertest(app).get("/health").expect(503);
    expect(res.body.healthy).toBe(false);
  });

  it("returns 503 when check function throws", async () => {
    const app = createApp(
      new HealthApp({
        check: () => {
          throw new Error("DB connection failed");
        },
      })
    );
    const res = await supertest(app).get("/health").expect(503);
    expect(res.body).toEqual({
      details: {error: "DB connection failed"},
      healthy: false,
    });
  });

  it("handles async check function", async () => {
    const app = createApp(
      new HealthApp({
        check: async () => ({
          details: {uptime: 100},
          healthy: true,
        }),
      })
    );
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body.healthy).toBe(true);
    expect(res.body.details.uptime).toBe(100);
  });

  it("handles async check function that rejects", async () => {
    const app = createApp(
      new HealthApp({
        check: async () => {
          throw new Error("Async failure");
        },
      })
    );
    const res = await supertest(app).get("/health").expect(503);
    expect(res.body).toEqual({
      details: {error: "Async failure"},
      healthy: false,
    });
  });

  it("defaults to empty options when none provided", async () => {
    const app = createApp(new HealthApp());
    const res = await supertest(app).get("/health").expect(200);
    expect(res.body).toEqual({healthy: true});
  });
});
