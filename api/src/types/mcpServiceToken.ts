import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

export interface McpServiceTokenIssueOptions {
  expiresAt?: Date;
  name: string;
}

export type McpServiceTokenMethods = Record<string, never>;

export interface McpServiceTokenStatics
  extends FindExactlyOnePlugin<McpServiceTokenDocument>,
    FindOneOrNonePlugin<McpServiceTokenDocument> {
  countActiveForUser: (
    this: McpServiceTokenModel,
    userId: mongoose.Types.ObjectId
  ) => Promise<number>;
  issueFor: (
    this: McpServiceTokenModel,
    user: {_id: {toString(): string}},
    options: McpServiceTokenIssueOptions
  ) => Promise<{mcpServiceToken: McpServiceTokenDocument; token: string}>;
  revokeForUser: (
    this: McpServiceTokenModel,
    user: {_id: {toString(): string}},
    tokenId: mongoose.Types.ObjectId
  ) => Promise<McpServiceTokenDocument | null>;
  verify: (this: McpServiceTokenModel, token: string) => Promise<McpServiceTokenDocument | null>;
}

export interface McpServiceTokenModel
  extends mongoose.Model<McpServiceTokenDocument, object, McpServiceTokenMethods>,
    McpServiceTokenStatics {}

export type McpServiceTokenSchema = mongoose.Schema<
  McpServiceTokenDocument,
  McpServiceTokenModel,
  McpServiceTokenMethods
>;

export interface McpServiceTokenDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  created: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  name: string;
  revokedAt?: Date;
  tokenHash: string;
  tokenPrefix: string;
  updated: Date;
  userId: mongoose.Types.ObjectId;
}
