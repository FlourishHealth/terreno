import type {AdminContribution, TerrenoPlugin} from "@terreno/api";
import type express from "express";

import {addAiRequestsExplorerRoutes} from "./routes/aiRequestsExplorer";

export interface AIAdminAppOptions {
  openApiOptions?: Record<string, unknown>;
}

/**
 * Registers the AI request explorer API and contributes its admin screen metadata.
 */
export class AIAdminApp implements TerrenoPlugin {
  private options: AIAdminAppOptions;

  constructor(options: AIAdminAppOptions = {}) {
    this.options = options;
  }

  adminContribution(): AdminContribution {
    return {
      customScreens: [{displayName: "AI Requests", icon: "robot", name: "ai-requests"}],
    };
  }

  register(app: express.Application): void {
    addAiRequestsExplorerRoutes(app, {openApiOptions: this.options.openApiOptions});
  }
}
