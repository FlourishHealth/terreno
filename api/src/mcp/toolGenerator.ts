import {toJSONSchema, type ZodType} from "zod";

import type {User} from "../auth";
import {createScopedLogger} from "../logger";
import {setRequestContext} from "../requestContext";
import {
  getMCPErrorCause,
  handleCreate,
  handleDelete,
  handleList,
  handleRead,
  handleUpdate,
} from "./handlers";
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

const getToolErrorMessage = (result: MCPToolResult): string => {
  const text = result.content[0]?.text;
  if (!text) {
    return "Unknown MCP tool error";
  }
  try {
    const parsed = JSON.parse(text) as {error?: unknown};
    return typeof parsed.error === "string" ? parsed.error : text;
  } catch {
    return text;
  }
};

const executeTool = async ({
  args,
  entry,
  handler,
  method,
  toolName,
  user,
}: {
  args: MCPToolArgs;
  entry: MCPRegistryEntry;
  handler: (entry: MCPRegistryEntry, args: MCPToolArgs, user?: User) => Promise<MCPToolResult>;
  method: MCPMethod;
  toolName: string;
  user?: User;
}): Promise<MCPToolResult> => {
  const userId = user?.id ?? (user?._id ? String(user._id) : undefined);
  if (userId) {
    setRequestContext({userId});
  }
  const log = createScopedLogger({
    labels: {
      mcpMethod: method,
      mcpModel: entry.modelName,
      mcpTool: toolName,
    },
    prefix: "[MCPTool]",
  });
  const startedAt = performance.now();

  try {
    const result = await handler(entry, args, user);
    const durationMs = Math.round(performance.now() - startedAt);
    if (!result.isError) {
      log.info("MCP tool call succeeded", {durationMs});
      return result;
    }

    const cause = getMCPErrorCause(result);
    const message = getToolErrorMessage(result);
    if (cause !== undefined) {
      // ScopedLogger.catch records the original exception and captures it in Sentry when enabled.
      log.catch(cause);
      log.error("MCP tool call failed", {durationMs, message});
    } else {
      // Permission, not-found, and input errors are expected failures: retain an audit trail
      // and Sentry log without reporting them as exceptions.
      log.warn("MCP tool call refused", {durationMs, message});
    }
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    log.catch(error);
    log.error("MCP tool call crashed", {durationMs});
    throw error;
  }
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
      entry.options.queryFields,
      entry.options.populatePaths
    );

    const inputSchema = toJSONSchema(zodSchema);

    const handler = METHOD_HANDLERS[method];
    const toolName = `${prefix}_${method}`;

    tools.push({
      description: generateToolDescription(
        entry.model,
        method,
        entry.config,
        entry.options.queryFields,
        entry.options.populatePaths
      ),
      handler: (args: MCPToolArgs, user?: User) =>
        executeTool({args, entry, handler, method, toolName, user}),
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
