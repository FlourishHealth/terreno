#!/usr/bin/env bun

import "./instrument.js";

import {createMcpExpressApp} from "@modelcontextprotocol/express";
import {toNodeHandler} from "@modelcontextprotocol/node";
import {createMcpHandler, McpServer} from "@modelcontextprotocol/server";
import * as Sentry from "@sentry/bun";
import {logger} from "@terreno/api";
import {handlePromptRequest, prompts} from "./prompts.js";
import {resources} from "./resources.js";
import {handleToolCall, tools} from "./tools.js";

const createServer = (): McpServer => {
  const server = Sentry.wrapMcpServerWithSentry(
    new McpServer(
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
    )
  );

  server.server.setRequestHandler("resources/list", async () => {
    return {
      resources: resources.map((r) => ({
        description: r.description,
        mimeType: r.mimeType,
        name: r.name,
        uri: r.uri,
      })),
    };
  });

  server.server.setRequestHandler("resources/read", async (request) => {
    logger.info("MCP ReadResource", {uri: request.params.uri});
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

  server.server.setRequestHandler("tools/list", async () => {
    return {tools};
  });

  server.server.setRequestHandler("tools/call", async (request) => {
    logger.info("MCP CallTool", {arguments: request.params.arguments, name: request.params.name});
    return handleToolCall(request.params.name, request.params.arguments ?? {});
  });

  server.server.setRequestHandler("prompts/list", async () => {
    return {
      prompts: prompts.map((p) => ({
        arguments: p.arguments,
        description: p.description,
        name: p.name,
      })),
    };
  });

  server.server.setRequestHandler("prompts/get", async (request) => {
    logger.info("MCP GetPrompt", {arguments: request.params.arguments, name: request.params.name});
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

const resolveHost = (): string => {
  const envHost = process.env.MCP_HOST ?? process.env.HOST;
  if (envHost) {
    return envHost;
  }

  return "0.0.0.0";
};

const handleMcpError = (error: Error): void => {
  Sentry.captureException(error);
  logger.error("Error handling MCP request", {error});
};

const main = async (): Promise<void> => {
  const {setupLogging} = (await import("@terreno/api")) as {
    setupLogging?: (options?: {disableConsoleColors?: boolean}) => void;
  };
  setupLogging?.({disableConsoleColors: process.env.NODE_ENV === "production"});
  const port = resolvePort();
  const host = resolveHost();
  const app = createMcpExpressApp({host});
  const handler = createMcpHandler(createServer, {
    legacy: "stateless",
    onerror: handleMcpError,
    responseMode: "auto",
  });
  const nodeHandler = toNodeHandler(handler);

  app.all("/mcp", (req, res) => {
    void nodeHandler(req, res, req.body);
  });
  app.post("/", (req, res) => {
    void nodeHandler(req, res, req.body);
  });
  app.get("/", (_req, res) => {
    res.status(200).json({
      mcpEndpoint: "/mcp",
      service: "terreno-mcp",
      status: "ok",
    });
  });

  app.listen(port, host, (error?: Error): void => {
    if (error) {
      logger.error("Failed to start server:", error);
      process.exit(1);
      return;
    }
    logger.info(`Terreno MCP server listening on ${host}:${port}`);
  });
};

main().catch((error) => {
  Sentry.captureException(error);
  logger.error("Fatal error starting MCP server:", error);
});
