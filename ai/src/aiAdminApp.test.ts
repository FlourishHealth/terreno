import {describe, expect, it, mock} from "bun:test";
import type express from "express";

const addAiRequestsExplorerRoutes = mock(() => {});

mock.module("./routes/aiRequestsExplorer", () => ({
  addAiRequestsExplorerRoutes,
}));

import {AIAdminApp} from "./aiAdminApp";

describe("AIAdminApp", () => {
  it("registers explorer routes and contributes the AI Requests screen", () => {
    const app = {} as express.Application;
    const plugin = new AIAdminApp({openApiOptions: {title: "Admin"}});

    plugin.register(app);

    expect(addAiRequestsExplorerRoutes).toHaveBeenCalledWith(app, {
      openApiOptions: {title: "Admin"},
    });
    expect(plugin.adminContribution()).toEqual({
      customScreens: [{displayName: "AI Requests", icon: "robot", name: "ai-requests"}],
    });
  });
});
