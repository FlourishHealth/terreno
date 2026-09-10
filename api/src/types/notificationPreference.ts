import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

export type NotificationPreferenceChannel = "inapp" | "mail" | "push" | "sms";

// biome-ignore lint/complexity/noBannedTypes: No methods.
export type NotificationPreferenceMethods = {};

export interface NotificationPreferenceStatics
  extends FindExactlyOnePlugin<NotificationPreferenceDocument>,
    FindOneOrNonePlugin<NotificationPreferenceDocument> {}

export interface NotificationPreferenceModel
  extends mongoose.Model<NotificationPreferenceDocument, object, NotificationPreferenceMethods>,
    NotificationPreferenceStatics {}

export interface NotificationPreferenceDocument
  extends mongoose.Document<string>,
    NotificationPreferenceMethods {
  _id: string;
  inapp: boolean;
  mail: boolean;
  ownerId: mongoose.Types.ObjectId;
  push: boolean;
  sms: boolean;
  created: Date;
  updated: Date;
  deleted: boolean;
}
