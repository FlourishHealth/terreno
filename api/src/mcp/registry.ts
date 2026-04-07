import type {Model} from "mongoose";

import type {ModelRouterOptions} from "../api";
import type {MCPConfig, MCPRegistryEntry} from "./types";

const mcpRegistry: MCPRegistryEntry[] = [];
let mcpRegistryVersion = 0;

export const registerMCPModel = (
  model: Model<any>,
  config: MCPConfig,
  options: ModelRouterOptions<any>
): void => {
  mcpRegistry.push({
    config,
    model,
    modelName: model.modelName,
    options,
  });
  mcpRegistryVersion += 1;
};

export const getMCPRegistry = (): MCPRegistryEntry[] => {
  return mcpRegistry;
};

export const getMCPRegistryVersion = (): number => {
  return mcpRegistryVersion;
};

export const clearMCPRegistry = (): void => {
  mcpRegistry.length = 0;
  mcpRegistryVersion += 1;
};
