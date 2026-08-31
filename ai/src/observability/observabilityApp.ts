import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

import {LocalEvaluatorStore} from "./local/evaluatorStore";
import {LocalPromptStore} from "./local/promptStore";
import {LocalTraceSink} from "./local/traceStore";
import {addObservabilityEvaluatorRoutes} from "./routes/evaluators";
import {addObservabilityPromptRoutes} from "./routes/prompts";
import {addObservabilityTraceRoutes} from "./routes/traces";
import type {
  ObservabilityAppOptions,
  ObservabilityControlConfig,
  ObservabilityGenerateClient,
  ObservabilityPlugin,
  PromptRegistry,
  ScoreSink,
  TraceSink,
} from "./types";
import {validateObservabilityConfig} from "./types";

let registeredObservabilityApp: ObservabilityApp | undefined;

export const getObservabilityApp = (): ObservabilityApp | undefined => {
  return registeredObservabilityApp;
};

export const resetObservabilityApp = (): void => {
  registeredObservabilityApp = undefined;
};

export class ObservabilityApp implements TerrenoPlugin {
  readonly aiService?: ObservabilityGenerateClient;
  readonly control: ObservabilityControlConfig;
  readonly plugins: ReadonlyArray<ObservabilityPlugin>;
  readonly priceMap: ObservabilityAppOptions["priceMap"];
  readonly sampleRate: number;

  constructor(options: ObservabilityAppOptions) {
    this.aiService = options.aiService;
    this.control = validateObservabilityConfig(options);
    this.plugins = options.plugins;
    this.priceMap = options.priceMap;
    this.sampleRate = options.sampleRate ?? 0;
    registeredObservabilityApp = this;
  }

  get promptRegistry(): PromptRegistry | undefined {
    const primary = this.control.prompts;
    return this.plugins.find((plugin) => {
      return plugin.id === primary;
    })?.promptRegistry;
  }

  get scoreSinks(): ScoreSink[] {
    return this.plugins.flatMap((plugin) => {
      return plugin.scoreSink ? [plugin.scoreSink] : [];
    });
  }

  get traceSinks(): TraceSink[] {
    return this.plugins.flatMap((plugin) => {
      return plugin.traceSink ? [plugin.traceSink] : [];
    });
  }

  register(app: express.Application, openApi?: unknown): void {
    if (this.control.prompts === "local") {
      const store = this.promptRegistry;
      if (store instanceof LocalPromptStore) {
        addObservabilityPromptRoutes(app, {
          aiService: this.aiService,
          openApi,
          priceMap: this.priceMap,
          store,
        });
      }
    }
    const localPlugin = this.plugins.find((plugin) => {
      return plugin.id === "local";
    });
    if (localPlugin?.traceSink instanceof LocalTraceSink) {
      addObservabilityTraceRoutes(app, {
        openApi,
        store: localPlugin.traceSink.store,
      });
    }
    if (localPlugin) {
      addObservabilityEvaluatorRoutes(app, {
        openApi,
        store: new LocalEvaluatorStore(),
      });
    }
  }
}
