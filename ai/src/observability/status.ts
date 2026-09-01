import type {ObservabilityApp} from "./observabilityApp";
import type {ObservabilityCapability, ObservabilityControlConfig} from "./types";

export interface ObservabilityPluginStatus {
  capabilities: ObservabilityCapability[];
  id: string;
}

export interface ObservabilityStatus {
  localOn: boolean;
  plugins: ObservabilityPluginStatus[];
  primaries: ObservabilityControlConfig;
}

export const isLocalObservabilityPluginOn = (plugins: ReadonlyArray<{id: string}>): boolean => {
  return plugins.some((plugin) => {
    return plugin.id === "local";
  });
};

export const buildObservabilityStatus = (app: ObservabilityApp): ObservabilityStatus => {
  return {
    localOn: isLocalObservabilityPluginOn(app.plugins),
    plugins: app.plugins.map((plugin) => {
      return {
        capabilities: [...plugin.capabilities].sort() as ObservabilityCapability[],
        id: plugin.id,
      };
    }),
    primaries: app.control,
  };
};
