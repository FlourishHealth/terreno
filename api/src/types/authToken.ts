import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

export type AuthTokenType = "passwordReset" | "emailVerification";

export type AuthTokenMethods = Record<string, never>;

export interface AuthTokenStatics
  extends FindExactlyOnePlugin<AuthTokenDocument>,
    FindOneOrNonePlugin<AuthTokenDocument> {
  consume: (
    this: AuthTokenModel,
    token: string,
    type: AuthTokenType
  ) => Promise<AuthTokenDocument | null>;
  invalidateUnusedFor: (
    this: AuthTokenModel,
    user: {_id: mongoose.Types.ObjectId | string},
    type: AuthTokenType
  ) => Promise<void>;
  issueFor: (
    this: AuthTokenModel,
    user: {_id: mongoose.Types.ObjectId | string},
    type: AuthTokenType
  ) => Promise<{authToken: AuthTokenDocument; token: string}>;
}

export interface AuthTokenModel
  extends mongoose.Model<AuthTokenDocument, object, AuthTokenMethods>,
    AuthTokenStatics {}

export type AuthTokenSchema = mongoose.Schema<AuthTokenDocument, AuthTokenModel, AuthTokenMethods>;

export interface AuthTokenDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  type: AuthTokenType;
  expiresAt: Date;
  consumedAt?: Date;
  created: Date;
  updated: Date;
}
