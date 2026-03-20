export {extractUserFromHeaders, type MCPAuthContext} from "./auth";
export {clearMCPRegistry, getMCPRegistry, registerMCPModel} from "./registry";
export {generateInputSchema, generateToolDescription} from "./schemaGenerator";
export {type MCPServerOptions, mountMCPServer} from "./server";
export {generateAllTools, generateToolsForEntry, type MCPToolDefinition} from "./toolGenerator";
export type {MCPConfig, MCPMethod, MCPRegistryEntry} from "./types";

import {type Tool, tool} from "ai";

import {getMCPRegistry} from "./registry";
import {generateAllTools} from "./toolGenerator";

/**
 * Returns all registered MCP tools as Vercel AI SDK CoreTool objects.
 * Use with streamText() or generateText() for direct in-process usage.
 */
export const getMCPTools = (): Record<string, Tool<any, any>> => {
  const registry = getMCPRegistry();
  const toolDefs = generateAllTools(registry);
  const result: Record<string, Tool<any, any>> = {};

  for (const toolDef of toolDefs) {
    // Use type assertion since ZodType is compatible at runtime but the AI SDK
    // generics are overly strict with the Tool overloads
    const coreTool = tool({
      description: toolDef.description,
      execute: async (args) => {
        const response = await toolDef.handler(args as Record<string, any>);
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
