import {toJSONSchema, type ZodType} from "zod";

import type {User} from "../auth";
import {handleCreate, handleDelete, handleList, handleRead, handleUpdate} from "./handlers";
import {generateInputSchema, generateToolDescription} from "./schemaGenerator";
import type {
  MCPMethod,
  MCPRegistryEntry,
  MCPToolArgs,
  MCPToolInputSchema,
  MCPToolResult,
} from "./types";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
  zodSchema: ZodType;
  handler: (args: MCPToolArgs, user?: User) => Promise<MCPToolResult>;
}

const getToolPrefix = (entry: MCPRegistryEntry): string => {
  if (entry.config.toolPrefix) {
    return entry.config.toolPrefix;
  }
  // Default: lowercase model name with simple pluralization. Irregular nouns are expected
  // to set config.toolPrefix rather than growing an exception list here.
  const name = entry.modelName.toLowerCase();
  if (/(?:s|x|z|ch|sh)$/.test(name)) {
    return `${name}es`;
  }
  if (name.endsWith("y") && !/[aeiou]y$/i.test(name)) {
    return `${name.slice(0, -1)}ies`;
  }
  return `${name}s`;
};

const METHOD_HANDLERS: Record<
  MCPMethod,
  (entry: MCPRegistryEntry, args: MCPToolArgs, user?: User) => Promise<MCPToolResult>
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
      handler: (args: MCPToolArgs, user?: User) => handler(entry, args, user),
      inputSchema: inputSchema as MCPToolInputSchema,
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
