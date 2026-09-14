import type {ObservabilityApp} from "./observabilityApp";
import type {ObservabilityCapability, ObservabilityControlConfig} from "./types";

export interface ObservabilityPluginStatus {
  capabilities: ObservabilityCapability[];
  id: string;
}

export type PlaygroundAiSource = "request-key" | "server" | "unavailable";

export interface PlaygroundAiStatus {
  source: PlaygroundAiSource;
}

export interface ObservabilityStatus {
  localOn: boolean;
  playgroundAi: PlaygroundAiStatus;
  plugins: ObservabilityPluginStatus[];
  primaries: ObservabilityControlConfig;
}

export const buildPlaygroundAiStatus = (app: ObservabilityApp): PlaygroundAiStatus => {
  if (app.aiService) {
    return {source: "server"};
  }
  if (app.requestAiServiceFactory) {
    return {source: "request-key"};
  }
  return {source: "unavailable"};
};

export const isLocalObservabilityPluginOn = (plugins: ReadonlyArray<{id: string}>): boolean => {
  return plugins.some((plugin) => {
    return plugin.id === "local";
  });
};

export const buildObservabilityStatus = (app: ObservabilityApp): ObservabilityStatus => {
  return {
    localOn: isLocalObservabilityPluginOn(app.plugins),
    playgroundAi: buildPlaygroundAiStatus(app),
    plugins: app.plugins.map((plugin) => {
      return {
        capabilities: [...plugin.capabilities].sort() as ObservabilityCapability[],
        id: plugin.id,
      };
    }),
    primaries: app.control,
  };
};
