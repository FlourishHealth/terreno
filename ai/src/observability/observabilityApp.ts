import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

import type {
  ObservabilityAppOptions,
  ObservabilityControlConfig,
  ObservabilityPlugin,
  ScoreSink,
  TraceSink,
} from "./types";
import {validateObservabilityConfig} from "./types";

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
