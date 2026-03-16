import type {TerrenoPlugin} from "@terreno/api";
import {logger} from "@terreno/api";
import type express from "express";

import {initLangfuseClient, shutdownLangfuseClient} from "./langfuseClient";
import {addEvaluationRoutes} from "./langfuseRoutesEvaluations";
import {addPlaygroundRoutes} from "./langfuseRoutesPlayground";
import {addPromptRoutes} from "./langfuseRoutesPrompts";
import {addTraceRoutes} from "./langfuseRoutesTraces";
import {initTracing, shutdownTracing} from "./langfuseTracing";
import type {LangfuseAppOptions} from "./langfuseTypes";

export class LangfuseApp implements TerrenoPlugin {
  private options: LangfuseAppOptions;

  constructor(options: LangfuseAppOptions) {
    this.options = options;
  }

  register(app: express.Application): void {
    const organization = this.options.organization ?? "flourish-health";
    const project = this.options.project ?? "terreno";
    initLangfuseClient(this.options);

    if (this.options.enableTracing !== false) {
      try {
        initTracing(this.options);
      } catch (err) {
        logger.warn(`Langfuse tracing initialization failed: ${err}`);
      }
    }

    if (this.options.enableAdminUI !== false) {
      const adminPath = this.options.adminPath ?? "/admin/langfuse";
      addPromptRoutes(app, adminPath);
      addTraceRoutes(app, adminPath);
      addPlaygroundRoutes(app, adminPath);

      if (this.options.evaluation?.enabled) {
        addEvaluationRoutes(app, adminPath, this.options.evaluation.scoringFunctions ?? []);
      }

      logger.info(
        `Langfuse admin routes mounted at ${adminPath} (org: ${organization}, project: ${project})`
      );
    }

    process.on("SIGTERM", () => {
      void this.shutdown();
    });
  }

  async shutdown(): Promise<void> {
    await shutdownLangfuseClient();
    await shutdownTracing();
  }
}
