import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

// biome-ignore lint/complexity/noBannedTypes: No methods.
export type ConsentResponseMethods = {};

export type ConsentResponseStatics = FindExactlyOnePlugin<ConsentResponseDocument> &
  FindOneOrNonePlugin<ConsentResponseDocument>;

export type ConsentResponseModel = mongoose.Model<
  ConsentResponseDocument,
  object,
  ConsentResponseMethods
> &
  ConsentResponseStatics;

export interface ConsentResponseDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  consentFormId: mongoose.Types.ObjectId;
  agreed: boolean;
  agreedAt: Date;
  checkboxValues?: Map<string, boolean>;
  locale: string;
  signature?: string;
  signedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  contentSnapshot?: string;
  formVersionSnapshot?: number;
  created: Date;
  updated: Date;
  deleted: boolean;
}
