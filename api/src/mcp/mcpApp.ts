import type express from "express";
import type {UserModel} from "../auth";
import type {TerrenoPlugin} from "../terrenoPlugin";
import {getMCPRegistry} from "./registry";
import {mountMCPServer} from "./server";

export interface MCPAppOptions {
  userModel: UserModel;
}

/**
 * TerrenoPlugin that mounts the MCP server endpoint.
 *
 * Only mounts if at least one model has been registered with MCP config.
 * Register this plugin with TerrenoApp to expose `/mcp` for LLM tool access.
 *
 * @example
 * ```typescript
 * const app = new TerrenoApp({ userModel: User })
 *   .register(todoRouter)
 *   .register(new MCPApp({ userModel: User }))
 *   .start();
 * ```
 */
export class MCPApp implements TerrenoPlugin {
  private options: MCPAppOptions;

  constructor(options: MCPAppOptions) {
    this.options = options;
  }

  register(app: express.Application): void {
    if (getMCPRegistry().length > 0) {
      mountMCPServer(app, {userModel: this.options.userModel});
    }
  }
}
