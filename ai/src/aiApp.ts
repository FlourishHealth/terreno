import type {TerrenoPlugin} from "@terreno/api";
import type {CoreTool, LanguageModel} from "ai";
import type express from "express";

import {addAiRequestsExplorerRoutes} from "./routes/aiRequestsExplorer";
import {addFileRoutes} from "./routes/files";
import {addGptRoutes} from "./routes/gpt";
import {addGptHistoryRoutes} from "./routes/gptHistories";
import {addMcpRoutes} from "./routes/mcp";
import type {AIService} from "./service/aiService";
import type {FileStorageService} from "./service/fileStorage";
import type {MCPService} from "./service/mcpService";

export interface AiAppOptions {
  aiService?: AIService;
  createModelFn?: (apiKey: string) => LanguageModel;
  demoMode?: boolean;
  fileStorageService?: FileStorageService;
  gcsBucket?: string;
  maxSteps?: number;
  mcpService?: MCPService;
  openApiOptions?: Record<string, unknown>;
  toolChoice?: "auto" | "none" | "required";
  tools?: Record<string, CoreTool>;
}

export class AiApp implements TerrenoPlugin {
  private options: AiAppOptions;

  constructor(options: AiAppOptions) {
    this.options = options;
  }

  register(app: express.Application): void {
    // Use app directly as the router — all addXxxRoutes functions accept `any`
    const router = app;
    const {
      aiService,
      createModelFn,
      demoMode,
      fileStorageService,
      gcsBucket,
      maxSteps,
      mcpService,
      openApiOptions,
      toolChoice,
      tools,
    } = this.options;

    addGptHistoryRoutes(router, {openApiOptions});
    addGptRoutes(router, {
      aiService,
      createModelFn,
      demoMode,
      maxSteps,
      mcpService,
      openApiOptions,
      toolChoice,
      tools,
    });
    addAiRequestsExplorerRoutes(router, {openApiOptions});

    if (fileStorageService && gcsBucket) {
      addFileRoutes(router, {
        fileStorageService,
        gcsBucket,
        openApiOptions,
      });
    }

    if (mcpService) {
      addMcpRoutes(router, {mcpService, openApiOptions});
    }
  }
}
