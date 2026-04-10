import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {CallToolRequestSchema, ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";
import type {TerrenoPlugin} from "@terreno/api";
import {authenticateMiddleware, logger} from "@terreno/api";
import type express from "express";
import type {Model} from "mongoose";
import {buildModelTools} from "./tools";

interface McpModelConfig {
  // biome-ignore lint/suspicious/noExplicitAny: Mongoose model generic
  model: Model<any>;
  name: string;
  description: string;
}

interface McpAppOptions {
  models: McpModelConfig[];
  basePath?: string;
}

export class McpApp implements TerrenoPlugin {
  private models: McpModelConfig[];
  private basePath: string;

  constructor(options: McpAppOptions) {
    this.models = options.models;
    this.basePath = options.basePath ?? "/mcp";
  }

  register(app: express.Application): void {
    const allTools = this.models.flatMap((config) =>
      buildModelTools(config.model, config.name, config.description)
    );

    const toolMap = new Map(allTools.map((t) => [t.tool.name, t]));

    const createServer = (): McpServer => {
      const server = new McpServer(
        {name: "terreno-example", version: "1.0.0"},
        {capabilities: {tools: {}}}
      );

      server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: allTools.map((t) => t.tool),
      }));

      server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const {name, arguments: args} = request.params;
        logger.info("MCP CallTool", {arguments: args, name});

        const toolDef = toolMap.get(name);
        if (!toolDef) {
          return {
            content: [{text: `Unknown tool: ${name}`, type: "text" as const}],
            isError: true,
          };
        }

        return toolDef.handler(args ?? {});
      });

      return server;
    };

    app.post(
      this.basePath,
      authenticateMiddleware(),
      async (req: express.Request, res: express.Response) => {
        const server = createServer();
        const transport = new StreamableHTTPServerTransport({sessionIdGenerator: undefined});

        try {
          logger.debug("Handling MCP request", {method: req.method, url: req.url});
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          logger.error("Error handling MCP request:", error);
          if (!res.headersSent) {
            res.status(500).json({
              error: {code: -32603, message: "Internal server error"},
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
      }
    );

    app.get(this.basePath, (_req: express.Request, res: express.Response) => {
      res.status(405).json({
        error: {code: -32000, message: "Method not allowed."},
        id: null,
        jsonrpc: "2.0",
      });
    });

    app.delete(this.basePath, (_req: express.Request, res: express.Response) => {
      res.status(405).json({
        error: {code: -32000, message: "Method not allowed."},
        id: null,
        jsonrpc: "2.0",
      });
    });

    logger.info(`MCP endpoint registered at ${this.basePath} with ${allTools.length} tools`);
  }
}
