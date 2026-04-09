import {toJSONSchema, type ZodType} from "zod";

import type {User} from "../auth";
import {handleCreate, handleDelete, handleList, handleRead, handleUpdate} from "./handlers";
import {generateInputSchema, generateToolDescription} from "./schemaGenerator";
import type {MCPMethod, MCPRegistryEntry} from "./types";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  zodSchema: ZodType;
  handler: (
    args: Record<string, any>,
    user?: User
  ) => Promise<{content: Array<{type: "text"; text: string}>}>;
}

const getToolPrefix = (entry: MCPRegistryEntry): string => {
  if (entry.config.toolPrefix) {
    return entry.config.toolPrefix;
  }
  // Default: lowercase model name with simple pluralization
  const name = entry.modelName.toLowerCase();
  if (name.endsWith("s") || name.endsWith("x") || name.endsWith("ch") || name.endsWith("sh")) {
    return `${name}es`;
  }
  if (name.endsWith("y") && !/[aeiou]y$/i.test(name)) {
    return `${name.slice(0, -1)}ies`;
  }
  return `${name}s`;
};

const METHOD_HANDLERS: Record<
  MCPMethod,
  (entry: MCPRegistryEntry, args: Record<string, any>, user?: User) => Promise<any>
> = {
  create: handleCreate,
  delete: handleDelete,
  list: handleList,
  read: handleRead,
  update: handleUpdate,
};

export const generateToolsForEntry = (entry: MCPRegistryEntry): MCPToolDefinition[] => {
  const methods = entry.config.methods ?? ["list", "read"];
  const prefix = getToolPrefix(entry);
  const tools: MCPToolDefinition[] = [];

  for (const method of methods) {
    // Skip methods with empty permission arrays (disabled)
    if (entry.options.permissions[method]?.length === 0) {
      continue;
    }

    const zodSchema = generateInputSchema(
      entry.model,
      method,
      entry.config,
      entry.options.queryFields
    );

    const inputSchema = toJSONSchema(zodSchema);

    const handler = METHOD_HANDLERS[method];
    const toolName = `${prefix}_${method}`;

    tools.push({
      description: generateToolDescription(
        entry.model,
        method,
        entry.config,
        entry.options.queryFields
      ),
      handler: (args: Record<string, any>, user?: User) => handler(entry, args, user),
      inputSchema: inputSchema as Record<string, any>,
      name: toolName,
      zodSchema,
    });
  }

  return tools;
};

export const generateAllTools = (entries: MCPRegistryEntry[]): MCPToolDefinition[] => {
  const tools: MCPToolDefinition[] = [];
  for (const entry of entries) {
    tools.push(...generateToolsForEntry(entry));
  }
  return tools;
};
