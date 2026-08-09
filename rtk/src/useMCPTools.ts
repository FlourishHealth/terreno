import {Client, StreamableHTTPClientTransport} from "@modelcontextprotocol/client";
import {useCallback, useEffect, useState} from "react";

import {getAuthToken} from "./authSlice";
import {baseUrl} from "./constants";

export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface UseMCPToolsOptions {
  /** Base URL of the Terreno backend. Defaults to the resolved baseUrl from constants. */
  baseURL?: string;
}

export interface UseMCPToolsResult {
  tools: MCPToolInfo[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that discovers available MCP tools from the backend.
 * Uses the official MCP client so protocol negotiation, the per-request 2026-07-28
 * metadata envelope, required routing headers, response parsing, and list caching stay
 * aligned with the specification.
 */
export const useMCPTools = (options: UseMCPToolsOptions = {}): UseMCPToolsResult => {
  const {baseURL = baseUrl} = options;
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getAuthToken();
      const client = new Client(
        {name: "terreno-rtk", version: "1.0.0"},
        {
          versionNegotiation: {mode: "auto"},
        }
      );
      const transport = new StreamableHTTPClientTransport(new URL(`${baseURL}/mcp`), {
        authProvider: token
          ? {
              token: async (): Promise<string> => token,
            }
          : undefined,
      });

      try {
        await client.connect(transport);
        const {tools: availableTools} = await client.listTools();
        setTools(
          availableTools.map((tool) => ({
            description: tool.description,
            inputSchema: tool.inputSchema as Record<string, unknown>,
            name: tool.name,
          }))
        );
      } finally {
        await client.close();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch MCP tools";
      setError(message);
      console.error("useMCPTools error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [baseURL]);

  // Fetch tools on mount
  useEffect(() => {
    void fetchTools();
  }, [fetchTools]);

  return {error, isLoading, refetch: fetchTools, tools};
};
