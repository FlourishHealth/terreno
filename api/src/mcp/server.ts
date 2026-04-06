import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type {Application, Request, Response} from "express";

import type {UserModel} from "../auth";
import {logger} from "../logger";
import {extractUserFromHeaders, type MCPAuthContext} from "./auth";
import {getMCPRegistry} from "./registry";
import {generateAllTools, type MCPToolDefinition} from "./toolGenerator";

export interface MCPServerOptions {
  userModel: UserModel;
  betterAuth?: any;
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
      return;
    }

    res.on("close", () => {
      transport.close();
      server.close();
    });
  };

  app.post("/mcp", handleMcpRequest);

  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      error: {
        code: -32000,
        message: "Method not allowed. Use POST for MCP requests.",
      },
      id: null,
      jsonrpc: "2.0",
    });
  });

  app.delete("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      error: {
        code: -32000,
        message: "Method not allowed.",
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
    server.tool(
      tool.name,
      tool.description,
      tool.zodSchema,
      async (args: Record<string, unknown>) => {
        // Extract user from the original request headers
        const user = await extractUserFromHeaders(
          req.headers as Record<string, string>,
          authContext
        );

        return tool.handler(args as Record<string, any>, user);
      }
    );
  }

  return server;
};
