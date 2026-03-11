import {APIError, asyncHandler, authenticateMiddleware, createOpenApiBuilder} from "@terreno/api";
import type express from "express";

import type {McpRouteOptions} from "../types";

export const addMcpRoutes = (router: any, options: McpRouteOptions): void => {
  const {mcpService} = options;

  router.get(
    "/mcp/servers",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options.openApiOptions ?? {})
        .withTags(["mcp"])
        .withSummary("List MCP servers and their status")
        .withArrayResponse(200, {
          connected: {type: "boolean"},
          name: {type: "string"},
        })
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = (req as any).user;
      if (!user?.admin) {
        throw new APIError({status: 403, title: "Admin access required"});
      }

      const servers = mcpService.getServerStatus();
      return res.json({data: servers});
    })
  );

  router.get(
    "/mcp/tools",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options.openApiOptions ?? {})
        .withTags(["mcp"])
        .withSummary("List available MCP tools")
        .withResponse(200, {tools: {items: {type: "object"}, type: "array"}})
        .build(),
    ],
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const tools = await mcpService.getTools();
      const toolList = Object.entries(tools).map(([name, tool]) => ({
        description: (tool as any).description,
        name,
        parameters: (tool as any).parameters,
      }));
      return res.json({data: toolList});
    })
  );

  router.post(
    "/mcp/servers/:name/reconnect",
    [
      authenticateMiddleware(),
      createOpenApiBuilder(options.openApiOptions ?? {})
        .withTags(["mcp"])
        .withSummary("Reconnect an MCP server")
        .withPathParameter("name", {type: "string"})
        .withResponse(200, {connected: {type: "boolean"}, name: {type: "string"}})
        .build(),
    ],
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const user = (req as any).user;
      if (!user?.admin) {
        throw new APIError({status: 403, title: "Admin access required"});
      }

      const name = req.params.name as string;
      const connected = await mcpService.reconnectServer(name);
      return res.json({data: {connected, name}});
    })
  );
};
