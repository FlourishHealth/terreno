import {type Tool, tool} from "ai";

import type {User} from "../auth";
import {getMCPRegistry} from "./registry";
import {generateAllTools} from "./toolGenerator";
import type {MCPToolArgs} from "./types";

/**
 * Returns all registered MCP tools as Vercel AI SDK tool objects.
 * Pass the authenticated user so tool handlers can enforce permissions.
 */
// noExplicitAny: Tool's input/output generics vary per tool schema
// biome-ignore lint/suspicious/noExplicitAny: Tool's input/output generics vary per tool schema
export const getMCPTools = (user?: User): Record<string, Tool<any, any>> => {
  const registry = getMCPRegistry();
  const toolDefs = generateAllTools(registry);
  // noExplicitAny: Tool's input/output generics vary per tool schema
  // biome-ignore lint/suspicious/noExplicitAny: Tool's input/output generics vary per tool schema
  const result: Record<string, Tool<any, any>> = {};

  for (const toolDef of toolDefs) {
    const coreTool = tool({
      description: toolDef.description,
      execute: async (args: unknown) => {
        const response = await toolDef.handler(args as MCPToolArgs, user);
        const text = response.content.map((c) => c.text).join("\n");
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      },
      parameters: toolDef.zodSchema,
      // noExplicitAny: the installed ai SDK types reject a runtime-built parameters schema
      // biome-ignore lint/suspicious/noExplicitAny: the installed ai SDK types reject a runtime-built parameters schema
    } as any);
    // noExplicitAny: Tool's input/output generics vary per tool schema
    // biome-ignore lint/suspicious/noExplicitAny: Tool's input/output generics vary per tool schema
    result[toolDef.name] = coreTool as Tool<any, any>;
  }

  return result;
};
