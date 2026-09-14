import {getAllMCPTools, type User} from "@terreno/api";
import {type Tool, tool} from "ai";

/**
 * Returns all registered MCP tools as Vercel AI SDK tool objects.
 * Pass the authenticated user so tool handlers can enforce permissions.
 */
export const getMCPTools = (user?: User): Record<string, Tool> => {
  const toolDefs = getAllMCPTools();
  const result: Record<string, Tool> = {};

  for (const toolDef of toolDefs) {
    const coreTool = tool({
      description: toolDef.description,
      execute: async (args: Record<string, unknown>) => {
        const response = await toolDef.handler(args, user);
        const text = response.content.map((c) => c.text).join("\n");
        try {
          return JSON.parse(text) as unknown;
        } catch {
          return text;
        }
      },
      parameters: toolDef.zodSchema,
    } as never) as unknown as Tool;
    result[toolDef.name] = coreTool;
  }

  return result;
};
