import type {Model} from "mongoose";

import type {ModelRouterOptions} from "../api";
import type {MCPConfig, MCPRegistryEntry} from "./types";

const mcpRegistry: MCPRegistryEntry[] = [];

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
};

export const getMCPRegistry = (): MCPRegistryEntry[] => {
  return mcpRegistry;
};

export const clearMCPRegistry = (): void => {
  mcpRegistry.length = 0;
};
