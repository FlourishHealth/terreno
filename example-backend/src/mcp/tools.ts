import type {CallToolResult, Tool} from "@modelcontextprotocol/sdk/types.js";
import {logger} from "@terreno/api";
import type {Model} from "mongoose";

interface McpToolDefinition {
  tool: Tool;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

const formatResult = (data: unknown): CallToolResult => ({
  content: [{text: JSON.stringify(data, null, 2), type: "text"}],
});

const formatError = (error: unknown): CallToolResult => ({
  content: [{text: `Error: ${(error as Error).message}`, type: "text"}],
  isError: true,
});

export const buildModelTools = (
  // biome-ignore lint/suspicious/noExplicitAny: Mongoose model generic
  model: Model<any>,
  name: string,
  description: string
): McpToolDefinition[] => {
  const lowerName = name.toLowerCase();

  return [
    {
      handler: async (args) => {
        try {
          const limit = (args.limit as number) ?? 20;
          const page = (args.page as number) ?? 1;
          const skip = (page - 1) * limit;
          const [data, total] = await Promise.all([
            model.find().sort("-created").skip(skip).limit(limit).lean(),
            model.countDocuments(),
          ]);
          return formatResult({data, limit, more: skip + data.length < total, page, total});
        } catch (error) {
          logger.error(`MCP list_${lowerName}s error:`, error);
          return formatError(error);
        }
      },
      tool: {
        description: `List all ${description}. Returns paginated results.`,
        inputSchema: {
          properties: {
            limit: {description: "Max items to return (default 20)", type: "number"},
            page: {description: "Page number (default 1)", type: "number"},
          },
          type: "object" as const,
        },
        name: `list_${lowerName}s`,
      },
    },
    {
      handler: async (args) => {
        try {
          const doc = await model.findById(args.id as string).lean();
          if (!doc) {
            return formatError(new Error(`${name} not found: ${args.id}`));
          }
          return formatResult({data: doc});
        } catch (error) {
          logger.error(`MCP get_${lowerName} error:`, error);
          return formatError(error);
        }
      },
      tool: {
        description: `Get a single ${lowerName} by ID.`,
        inputSchema: {
          properties: {
            id: {description: `The ${lowerName} ID`, type: "string"},
          },
          required: ["id"],
          type: "object" as const,
        },
        name: `get_${lowerName}`,
      },
    },
    {
      handler: async (args) => {
        try {
          const body = JSON.parse(args.data as string);
          const doc = await model.create(body);
          return formatResult({data: doc.toJSON()});
        } catch (error) {
          logger.error(`MCP create_${lowerName} error:`, error);
          return formatError(error);
        }
      },
      tool: {
        description: `Create a new ${lowerName}. Pass the fields as arguments.`,
        inputSchema: {
          properties: {
            data: {description: `JSON string with ${lowerName} fields`, type: "string"},
          },
          required: ["data"],
          type: "object" as const,
        },
        name: `create_${lowerName}`,
      },
    },
    {
      handler: async (args) => {
        try {
          const body = JSON.parse(args.data as string);
          const doc = await model.findByIdAndUpdate(args.id as string, body, {new: true}).lean();
          if (!doc) {
            return formatError(new Error(`${name} not found: ${args.id}`));
          }
          return formatResult({data: doc});
        } catch (error) {
          logger.error(`MCP update_${lowerName} error:`, error);
          return formatError(error);
        }
      },
      tool: {
        description: `Update an existing ${lowerName} by ID.`,
        inputSchema: {
          properties: {
            data: {description: "JSON string with fields to update", type: "string"},
            id: {description: `The ${lowerName} ID`, type: "string"},
          },
          required: ["id", "data"],
          type: "object" as const,
        },
        name: `update_${lowerName}`,
      },
    },
    {
      handler: async (args) => {
        try {
          const doc = await model.findByIdAndDelete(args.id as string).lean();
          if (!doc) {
            return formatError(new Error(`${name} not found: ${args.id}`));
          }
          return formatResult({deleted: true, id: args.id});
        } catch (error) {
          logger.error(`MCP delete_${lowerName} error:`, error);
          return formatError(error);
        }
      },
      tool: {
        description: `Delete a ${lowerName} by ID.`,
        inputSchema: {
          properties: {
            id: {description: `The ${lowerName} ID`, type: "string"},
          },
          required: ["id"],
          type: "object" as const,
        },
        name: `delete_${lowerName}`,
      },
    },
  ];
};
