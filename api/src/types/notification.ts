import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

type NotificationMethods = Record<never, never>;

interface NotificationStatics
  extends FindExactlyOnePlugin<NotificationDocument>,
    FindOneOrNonePlugin<NotificationDocument> {}

export interface NotificationModel
  extends mongoose.Model<NotificationDocument, object, NotificationMethods>,
    NotificationStatics {}

export interface NotificationDocument extends mongoose.Document<string>, NotificationMethods {
  _id: string;
  body: string;
  href?: string;
  kind?: string;
  ownerId: mongoose.Types.ObjectId;
  readAt: Date | null;
  title: string;
  created: Date;
  updated: Date;
  deleted: boolean;
}

export interface NotifyInput {
  body: string;
  href?: string;
  kind?: string;
  title: string;
  userId: string;
}
