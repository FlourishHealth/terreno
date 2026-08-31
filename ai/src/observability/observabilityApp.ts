import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

import type {
  ObservabilityAppOptions,
  ObservabilityControlConfig,
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
  readonly control: ObservabilityControlConfig;
  readonly plugins: ReadonlyArray<ObservabilityPlugin>;
  readonly priceMap: ObservabilityAppOptions["priceMap"];
  readonly sampleRate: number;

  constructor(options: ObservabilityAppOptions) {
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

  register(_app: express.Application): void {
    return;
  }
}
