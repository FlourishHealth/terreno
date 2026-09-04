import {afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test";
import {TerrenoApp} from "@terreno/api";
import type express from "express";

import {authAsUser, ensureTestUsers, UserModel} from "../../tests/helpers";
import {createLocalObservabilityPlugin} from "../local/localPlugin";
import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";
import type {ObservabilityPlugin} from "../types";

const createLangfusePlugin = (): ObservabilityPlugin => {
  return {
    capabilities: new Set(["datasets", "experiments", "prompts", "scores", "traces"]),
    datasetStore: {},
    experimentRunner: {},
    id: "langfuse",
    promptRegistry: {get: async () => undefined},
    scoreSink: {export: async () => {}},
    traceSink: {export: async () => {}},
  };
};

describe("observability status routes", () => {
  let app: express.Application;

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(() => {
    app = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(
        new ObservabilityApp({
          plugins: [createLocalObservabilityPlugin(), createLangfusePlugin()],
        })
      )
      .build();
  });

  it("returns plugin ids, capabilities, primaries, and local-on for admins", async () => {
    const agent = await authAsUser(app, "admin");
    const response = await agent.get("/ai/observability/status");
    expect(response.status).toBe(200);
    expect(response.body.data.localOn).toBe(true);
    expect(response.body.data.primaries).toEqual({
      datasets: "local",
      experiments: "local",
      prompts: "local",
      reviewQueue: "local",
    });
    expect(response.body.data.plugins.map((plugin: {id: string}) => plugin.id)).toEqual([
      "local",
      "langfuse",
    ]);
    expect(response.body.data.plugins[0].capabilities).toContain("reviewQueue");
  });

  it("rejects non-admin callers", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const response = await agent.get("/ai/observability/status");
    expect(response.status).toBe(403);
  });
});
