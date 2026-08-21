import type {Model} from "mongoose";
import type {ZodType} from "zod";

import type {ModelRouterOptions} from "../api";
import type {User} from "../auth";
import type {MCPConfig, MCPRegistryEntry, MCPToolArgs, MCPToolResult} from "./types";

export interface MCPCustomTool {
  description: string;
  handler: (args: MCPToolArgs, user?: User) => Promise<MCPToolResult>;
  name: string;
  zodSchema: ZodType;
}

const mcpRegistry: MCPRegistryEntry[] = [];
const mcpCustomTools: MCPCustomTool[] = [];

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

/**
 * Replace options on an existing MCP registry entry after TerrenoApp injects
 * accessControl (same contract as updateRealtimeRegistryOptions).
 */
export const updateMCPRegistryOptions = (
  modelName: string,
  // noExplicitAny: ModelRouterOptions is generic over the consumer's document type
  // biome-ignore lint/suspicious/noExplicitAny: ModelRouterOptions is generic over the consumer's document type
  options: ModelRouterOptions<any>
): void => {
  const existing = mcpRegistry.find((entry) => entry.modelName === modelName);
  if (!existing) {
    return;
  }
  existing.options = options;
};

export const registerMCPTool = (tool: MCPCustomTool): void => {
  const existingIndex = mcpCustomTools.findIndex((registered) => registered.name === tool.name);
  if (existingIndex >= 0) {
    mcpCustomTools[existingIndex] = tool;
    return;
  }
  mcpCustomTools.push(tool);
};

export const getMCPRegistry = (): MCPRegistryEntry[] => {
  return mcpRegistry;
};

export const getMCPCustomTools = (): MCPCustomTool[] => {
  return mcpCustomTools;
};

export const clearMCPRegistry = (): void => {
  mcpRegistry.length = 0;
  mcpCustomTools.length = 0;
};
