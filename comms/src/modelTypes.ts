import type {FindExactlyOnePlugin, FindOneOrNonePlugin, HasUpsert} from "@terreno/api";
import type mongoose from "mongoose";

import type {CommsChannel, CommsMessageStatus} from "./types";

export type CommsMessageMethods = Record<never, never>;

export interface CommsMessageDocument
  extends mongoose.Document<mongoose.Types.ObjectId>,
    CommsMessageMethods {
  channel: CommsChannel;
  created: Date;
  deleted: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  provider: string;
  providerMessageId?: string;
  status: CommsMessageStatus;
  subject?: string;
  to: string;
  updated: Date;
  userId?: mongoose.Types.ObjectId;
}

export interface LogSendParams {
  channel: CommsChannel;
  error?: string;
  metadata?: Record<string, unknown>;
  provider: string;
  providerMessageId?: string;
  status: CommsMessageStatus;
  subject?: string;
  to: string;
  userId?: mongoose.Types.ObjectId | string;
}

export interface CommsMessageStatics
  extends FindExactlyOnePlugin<CommsMessageDocument>,
    FindOneOrNonePlugin<CommsMessageDocument> {
  logSend(params: LogSendParams): Promise<CommsMessageDocument | null>;
}

export interface CommsMessageModel
  extends mongoose.Model<CommsMessageDocument>,
    CommsMessageStatics {}

export type CommsMessageSchema = mongoose.Schema<
  CommsMessageDocument,
  CommsMessageModel,
  CommsMessageMethods
>;

export type PushTokenPlatform = "android" | "ios" | "web";

export type PushTokenMethods = Record<never, never>;

export interface PushTokenDocument
  extends mongoose.Document<mongoose.Types.ObjectId>,
    PushTokenMethods {
  active: boolean;
  created: Date;
  deleted: boolean;
  deviceId?: string;
  lastSeenAt: Date;
  platform: PushTokenPlatform;
  token: string;
  updated: Date;
  userId: mongoose.Types.ObjectId;
}

export interface PushTokenStatics
  extends FindExactlyOnePlugin<PushTokenDocument>,
    FindOneOrNonePlugin<PushTokenDocument>,
    HasUpsert<PushTokenDocument> {}

export interface PushTokenModel extends mongoose.Model<PushTokenDocument>, PushTokenStatics {}

export type PushTokenSchema = mongoose.Schema<PushTokenDocument, PushTokenModel, PushTokenMethods>;
