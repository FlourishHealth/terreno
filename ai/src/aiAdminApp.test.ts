import {describe, expect, it} from "bun:test";
import express from "express";

import {AIAdminApp} from "./aiAdminApp";

describe("AIAdminApp", () => {
  it("registers explorer routes and contributes the AI Requests screen", () => {
    const app = express();
    const plugin = new AIAdminApp({openApiOptions: {title: "Admin"}});

    plugin.register(app);

    const routePaths = (app.router.stack as Array<{route?: {path?: string}}>).flatMap((layer) =>
      layer.route?.path ? [layer.route.path] : []
    );
    expect(routePaths).toContain("/aiRequestsExplorer");
    expect(plugin.adminContribution()).toEqual({
      customScreens: [{displayName: "AI Requests", icon: "robot", name: "ai-requests"}],
    });
  });
});
