import {toNodeHandler} from "@modelcontextprotocol/node";
import {createMcpHandler, McpServer} from "@modelcontextprotocol/server";
import type {Application, Request, Response} from "express";

import type {UserModel} from "../auth";
import type {BetterAuthInstance} from "../betterAuthSetup";
import {logger} from "../logger";
import {setRequestContext} from "../requestContext";
import {extractUserFromHeaders, type MCPAuthContext} from "./auth";
import {getAllMCPTools, type MCPToolDefinition} from "./toolGenerator";

export interface MCPServerOptions {
  userModel: UserModel;
  betterAuth?: BetterAuthInstance;
  mcpServiceTokens?: boolean;
}

export const mountMCPServer = (app: Application, options: MCPServerOptions): void => {
  const tools = getAllMCPTools();
  if (tools.length === 0) {
    return;
  }
  const authContext: MCPAuthContext = {
    betterAuth: options.betterAuth,
    mcpServiceTokens: options.mcpServiceTokens,
    userModel: options.userModel,
  };

  logger.info(`Mounting MCP server with ${tools.length} tools at /mcp`);

  // The 2026-07-28 handler is stateless: it creates one server per request and also serves
  // 2025-era clients through the SDK's stateless legacy fallback.
  const handler = createMcpHandler(
    async ({requestInfo}) => {
      const headers: Record<string, string> = {};
      requestInfo?.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const user = await extractUserFromHeaders(headers, authContext);
      if (user?.id) {
        setRequestContext({userId: user.id});
      }
      return createMcpServerInstance(tools, user);
    },
    {
      legacy: "stateless",
      onerror: (error) => logger.catch(error),
      responseMode: "auto",
    }
  );
  const nodeHandler = toNodeHandler(handler);

  app.all("/mcp", (req: Request, res: Response) => {
    // express.json() consumed the request stream, so pass its parsed body explicitly.
    void nodeHandler(req, res, req.body);
  });
};

const createMcpServerInstance = (
  tools: MCPToolDefinition[],
  user?: Awaited<ReturnType<typeof extractUserFromHeaders>>
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
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.zodSchema,
      },
      async (args: unknown) => tool.handler(args as Record<string, unknown>, user)
    );
  }

  return server;
};
