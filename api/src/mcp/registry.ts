import type {Model} from "mongoose";

import type {ModelRouterOptions} from "../api";
import type {MCPConfig, MCPRegistryEntry} from "./types";

const mcpRegistry: MCPRegistryEntry[] = [];

export const registerMCPModel = (
  // noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  // biome-ignore lint/suspicious/noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  model: Model<any>,
  config: MCPConfig,
  // noExplicitAny: ModelRouterOptions is generic over the consumer's document type
  // biome-ignore lint/suspicious/noExplicitAny: ModelRouterOptions is generic over the consumer's document type
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
