import type {CoreTool} from "ai";
import {experimental_createMCPClient as createMCPClient} from "ai";

import type {MCPServerConfig} from "../types";

interface MCPClientInstance {
  close: () => Promise<void>;
  tools: () => Promise<Record<string, CoreTool>>;
}

interface MCPConnection {
  client: MCPClientInstance | null;
  config: MCPServerConfig;
  connected: boolean;
}

export class MCPService {
  private connections: Map<string, MCPConnection> = new Map();

  constructor(servers: MCPServerConfig[]) {
    for (const config of servers) {
      this.connections.set(config.name, {client: null, config, connected: false});
    }
  }

  async connect(): Promise<void> {
    const connectPromises = Array.from(this.connections.entries()).map(
      async ([_name, connection]) => {
        try {
          const client = await createMCPClient({
            transport: {
              headers: connection.config.transport.headers,
              type: "sse",
              url: connection.config.transport.url,
            },
          });
          connection.client = client as unknown as MCPClientInstance;
          connection.connected = true;
        } catch {
          connection.connected = false;
          connection.client = null;
        }
      }
    );

    await Promise.allSettled(connectPromises);
  }

  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.values()).map(async (connection) => {
      if (connection.client) {
        try {
          await connection.client.close();
        } catch {
          // Ignore disconnect errors
        }
        connection.client = null;
        connection.connected = false;
      }
    });

    await Promise.allSettled(disconnectPromises);
  }

  async reconnectServer(name: string): Promise<boolean> {
    const connection = this.connections.get(name);
    if (!connection) {
      return false;
    }

    if (connection.client) {
      try {
        await connection.client.close();
      } catch {
        // Ignore
      }
    }

    try {
      const client = await createMCPClient({
        transport: {
          headers: connection.config.transport.headers,
          type: "sse",
          url: connection.config.transport.url,
        },
      });
      connection.client = client as unknown as MCPClientInstance;
      connection.connected = true;
      return true;
    } catch {
      connection.connected = false;
      connection.client = null;
      return false;
    }
  }

  async getTools(): Promise<Record<string, CoreTool>> {
    const allTools: Record<string, CoreTool> = {};

    for (const [, connection] of this.connections) {
      if (connection.connected && connection.client) {
        try {
          const tools = await connection.client.tools();
          Object.assign(allTools, tools);
        } catch {
          // Skip tools from failed servers
        }
      }
    }

    return allTools;
  }

  getServerStatus(): Array<{name: string; connected: boolean}> {
    return Array.from(this.connections.entries()).map(([name, connection]) => ({
      connected: connection.connected,
      name,
    }));
  }
}
