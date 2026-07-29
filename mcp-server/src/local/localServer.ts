import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {CallToolRequestSchema, ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";

import {handleLocalToolCall, localMcpTools} from "./localTools.js";

export const startLocalMcpServer = async (): Promise<void> => {
  const server = new Server(
    {
      name: "terreno-mcp-local",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {tools: localMcpTools};
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    return handleLocalToolCall(name, args);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
};
