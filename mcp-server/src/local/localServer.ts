import {Server} from "@modelcontextprotocol/server";
import {serveStdio} from "@modelcontextprotocol/server/stdio";

import {handleLocalToolCall, localMcpTools} from "./localTools.js";

const createLocalMcpServer = (): Server => {
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

  server.setRequestHandler("tools/list", async () => {
    return {tools: localMcpTools};
  });

  server.setRequestHandler("tools/call", async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    return handleLocalToolCall(name, args);
  });

  return server;
};

export const startLocalMcpServer = async (): Promise<void> => {
  serveStdio(createLocalMcpServer, {legacy: "serve"});
};
