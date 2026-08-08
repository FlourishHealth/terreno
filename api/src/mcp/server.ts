import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type {Application, Request, Response} from "express";
import type {ZodRawShape} from "zod";

import type {UserModel} from "../auth";
import type {BetterAuthInstance} from "../betterAuthSetup";
import {logger} from "../logger";
import {extractUserFromHeaders, type MCPAuthContext} from "./auth";
import {getMCPRegistry} from "./registry";
import {generateAllTools, type MCPToolDefinition} from "./toolGenerator";

export interface MCPServerOptions {
  userModel: UserModel;
  betterAuth?: BetterAuthInstance;
}

export const mountMCPServer = (app: Application, options: MCPServerOptions): void => {
  const registry = getMCPRegistry();
  if (registry.length === 0) {
    return;
  }

  const tools = generateAllTools(registry);
  const authContext: MCPAuthContext = {
    betterAuth: options.betterAuth,
    userModel: options.userModel,
  };

  logger.info(`Mounting MCP server with ${tools.length} tools at /mcp`);

  const handleMcpRequest = async (req: Request, res: Response): Promise<void> => {
    const server = createMcpServerInstance(tools, authContext, req);
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined});

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error(`MCP request error: ${error}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
          jsonrpc: "2.0",
        });
      }
      transport.close().catch(() => {});
      server.close().catch(() => {});
      return;
    }

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
  };

  app.post("/mcp", handleMcpRequest);

  // Every other verb (GET, DELETE, PATCH, PUT, ...) gets the same JSON-RPC 405 so clients
  // that probe the endpoint receive a protocol-shaped error instead of Express HTML.
  app.all("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      error: {
        code: -32000,
        message: "Method not allowed. Use POST for MCP requests.",
      },
      id: null,
      jsonrpc: "2.0",
    });
  });
};

const createMcpServerInstance = (
  tools: MCPToolDefinition[],
  authContext: MCPAuthContext,
  req: Request
): McpServer => {
  const server = new McpServer(
    {
      name: "terreno-api-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register each tool with the MCP server
  for (const tool of tools) {
    // McpServer.tool() expects a Zod raw shape (e.g. {id: z.string()}), not JSON Schema.
    // The zodSchema from generateInputSchema is a z.object(), so extract its .shape.
    const zodShape =
      "shape" in tool.zodSchema
        ? (tool.zodSchema as unknown as {shape: ZodRawShape}).shape
        : ({} as ZodRawShape);
    server.tool(tool.name, tool.description, zodShape, async (args: Record<string, unknown>) => {
      // Extract user from the original request headers
      const user = await extractUserFromHeaders(req.headers as Record<string, string>, authContext);

      return tool.handler(args, user);
    });
  }

  return server;
};
