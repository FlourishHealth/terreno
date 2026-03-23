import mongoose from "mongoose";
import type {McpServerDocument, McpServerModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const mcpServerSchema = new mongoose.Schema<McpServerDocument, McpServerModel>(
  {
    apiKey: {
      description: "Optional API key for authenticating with the MCP server",
      type: String,
    },
    enabled: {
      default: true,
      description: "Whether this MCP server connection is active",
      type: Boolean,
    },
    name: {
      description: "Display name for this MCP server",
      required: true,
      trim: true,
      type: String,
    },
    ownerId: {
      description: "The user who configured this MCP server",
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    url: {
      description: "The URL endpoint for the MCP server",
      required: true,
      trim: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins(mcpServerSchema);

export const McpServer = mongoose.model<McpServerDocument, McpServerModel>(
  "McpServer",
  mcpServerSchema
);
