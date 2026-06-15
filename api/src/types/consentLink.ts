import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

// biome-ignore lint/complexity/noBannedTypes: No methods.
export type ConsentLinkMethods = {};

export interface ConsentLinkStatics
  extends FindExactlyOnePlugin<ConsentLinkDocument>,
    FindOneOrNonePlugin<ConsentLinkDocument> {}

export interface ConsentLinkModel
  extends mongoose.Model<ConsentLinkDocument, object, ConsentLinkMethods>,
    ConsentLinkStatics {}

export interface ConsentLinkDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  consentFormIds?: mongoose.Types.ObjectId[];
  tokenHash: string;
  expiresAt: Date;
  maxUses: number;
  useCount: number;
  usedAt?: Date;
  revoked: boolean;
  createdByUserId?: mongoose.Types.ObjectId;
  lastUsedIp?: string;
  note?: string;
  created: Date;
  updated: Date;
  deleted: boolean;
}
