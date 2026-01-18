#!/usr/bin/env node

import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {handlePromptRequest, prompts} from "./prompts.js";
import {resources} from "./resources.js";
import {handleToolCall, tools} from "./tools.js";

const server = new Server(
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

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resources.map((r) => ({
      description: r.description,
      mimeType: r.mimeType,
      name: r.name,
      uri: r.uri,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {tools};
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  return handleToolCall(request.params.name, request.params.arguments ?? {});
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: prompts.map((p) => ({
      arguments: p.arguments,
      description: p.description,
      name: p.name,
    })),
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  return handlePromptRequest(request.params.name, request.params.arguments ?? {});
});

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Terreno MCP server running on stdio");
};

main().catch(console.error);
