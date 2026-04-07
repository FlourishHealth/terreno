export {extractUserFromHeaders, type MCPAuthContext} from "./auth";
export {
  clearMCPRegistry,
  getMCPRegistry,
  getMCPRegistryVersion,
  registerMCPModel,
} from "./registry";
export {generateInputSchema, generateToolDescription} from "./schemaGenerator";
export {type MCPServerOptions, mountMCPServer} from "./server";
export {generateAllTools, generateToolsForEntry, type MCPToolDefinition} from "./toolGenerator";
export type {MCPConfig, MCPMethod, MCPRegistryEntry} from "./types";

import {type Tool, tool} from "ai";

import type {User} from "../auth";
import {getMCPRegistry, getMCPRegistryVersion} from "./registry";
import {generateAllTools} from "./toolGenerator";

let cachedRegistryVersion = -1;
let cachedToolDefs = generateAllTools(getMCPRegistry());

const getCachedToolDefs = () => {
  const registryVersion = getMCPRegistryVersion();
  if (registryVersion !== cachedRegistryVersion) {
    cachedToolDefs = generateAllTools(getMCPRegistry());
    cachedRegistryVersion = registryVersion;
  }
  return cachedToolDefs;
};

/**
 * Returns all registered MCP tools as Vercel AI SDK CoreTool objects.
 * Pass the authenticated user so tool handlers can enforce permissions.
 */
export const getMCPTools = (user?: User): Record<string, Tool<any, any>> => {
  const toolDefs = getCachedToolDefs();
  const result: Record<string, Tool<any, any>> = {};

  for (const toolDef of toolDefs) {
    const coreTool = tool({
      description: toolDef.description,
      execute: async (args) => {
        const response = await toolDef.handler(args as Record<string, any>, user);
        const text = response.content.map((c) => c.text).join("\n");
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      },
      parameters: toolDef.zodSchema,
    } as any);
    result[toolDef.name] = coreTool as Tool<any, any>;
  }

  return result;
};
