import type {Model} from "mongoose";

import type {JSONValue, ModelRouterOptions} from "../api";
import type {User} from "../auth";

export type MCPMethod = "create" | "list" | "read" | "update" | "delete";

export interface MCPConfig {
  /** Which CRUD methods to expose as MCP tools. Default: ['list', 'read'] */
  methods?: MCPMethod[];
  /** Override auto-generated model description */
  description?: string;
  /** Override tool name prefix (default: pluralized lowercase model name) */
  toolPrefix?: string;
  /** Fields to hide from MCP tool schemas and responses */
  excludeFields?: string[];
  /** Max items returned by list tool (default: 50) */
  maxLimit?: number;
  /** MCP-specific serialization (separate from REST responseHandler) */
  mcpResponseHandler?: (value: any, method: MCPMethod, user?: User) => Promise<JSONValue>;
}

export interface MCPRegistryEntry {
  modelName: string;
  model: Model<any>;
  config: MCPConfig;
  options: ModelRouterOptions<any>;
}
