import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";
import type {BaseDocument} from "../../modelInterfaces";

// McpServer Model Types
// biome-ignore lint/complexity/noBannedTypes: No methods.
export type McpServerMethods = {};

export type McpServerStatics = FindExactlyOnePlugin<McpServerDocument> &
  FindOneOrNonePlugin<McpServerDocument>;

export type McpServerModel = mongoose.Model<McpServerDocument, object, McpServerMethods> &
  McpServerStatics;

export type McpServerDocument = BaseDocument &
  McpServerMethods & {
    name: string;
    url: string;
    enabled: boolean;
    apiKey?: string;
    ownerId: mongoose.Types.ObjectId;
  };
