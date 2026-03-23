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

interface MCPJsonRpcResponse {
  result?: {
    tools?: Array<{name: string; description?: string; inputSchema?: Record<string, unknown>}>;
  };
  error?: {message?: string};
}

/**
 * Hook that discovers available MCP tools from the backend.
 * Makes a JSON-RPC call to the /mcp endpoint to list tools.
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
      const headers: Record<string, string> = {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${baseURL}/mcp`, {
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
        }),
        headers,
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`MCP request failed: ${response.status}`);
      }

      const data: MCPJsonRpcResponse = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "MCP error");
      }

      const toolList: MCPToolInfo[] = (data.result?.tools ?? []).map((t) => ({
        description: t.description,
        inputSchema: t.inputSchema,
        name: t.name,
      }));

      setTools(toolList);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch MCP tools";
      setError(message);
      console.error("useMCPTools error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [baseURL]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  return {error, isLoading, refetch: fetchTools, tools};
};
