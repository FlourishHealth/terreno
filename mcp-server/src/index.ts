#!/usr/bin/env bun

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {createMcpExpressApp} from "@modelcontextprotocol/sdk/server/express.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {logger} from "@terreno/api";
import {handlePromptRequest, prompts} from "./prompts.js";
import {resources} from "./resources.js";
import {handleToolCall, tools} from "./tools.js";

const createServer = (): McpServer => {
  const server = new McpServer(
    {
      name: "terreno-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: {},
        tools: {},
      },
    }
  );

  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: resources.map((r) => ({
        description: r.description,
        mimeType: r.mimeType,
        name: r.name,
        uri: r.uri,
      })),
    };
  });

  server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resources.find((r) => r.uri === request.params.uri);
    if (!resource) {
      throw new Error(`Resource not found: ${request.params.uri}`);
    }
    return {
      contents: [
        {
          mimeType: resource.mimeType,
          text: resource.content,
          uri: resource.uri,
        },
      ],
    };
  });

  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {tools};
  });

  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request.params.name, request.params.arguments ?? {});
  });

  server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: prompts.map((p) => ({
        arguments: p.arguments,
        description: p.description,
        name: p.name,
      })),
    };
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return handlePromptRequest(request.params.name, request.params.arguments ?? {});
  });

  return server;
};

const resolvePort = (): number => {
  const envPort = process.env.PORT;
  if (!envPort) {
    return 8080;
  }

  const parsedPort = Number.parseInt(envPort, 10);
  if (Number.isNaN(parsedPort)) {
    throw new Error(`Invalid PORT value: ${envPort}`);
  }

  return parsedPort;
};

type McpRequest = Parameters<StreamableHTTPServerTransport["handleRequest"]>[0] & {
  body?: unknown;
};
type McpResponse = Parameters<StreamableHTTPServerTransport["handleRequest"]>[1] & {
  headersSent?: boolean;
  status: (code: number) => McpResponse;
  json: (body: unknown) => void;
};

const handleMcpRequest = async (req: McpRequest, res: McpResponse): Promise<void> => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined});

  try {
    logger.debug("Handling MCP request", {
      method: req.method,
      url: req.url,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
    return;
  }

  res.on("close", () => {
    transport.close();
    server.close();
  });
};

const handleUnsupportedMethod = async (
  _req: McpRequest,
  res: McpResponse
): Promise<void> => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
};

const main = async (): Promise<void> => {
  const port = resolvePort();
  const app = createMcpExpressApp();

  app.post("/mcp", handleMcpRequest);
  app.get("/mcp", handleUnsupportedMethod);
  app.delete("/mcp", handleUnsupportedMethod);

  app.listen(port, (error?: Error): void => {
    if (error) {
      logger.error("Failed to start server:", error);
      process.exit(1);
      return;
    }
    logger.info(`Terreno MCP server listening on port ${port}`);
  });
};

main().catch((error) => {
  logger.error("Fatal error starting MCP server:", error);
});
