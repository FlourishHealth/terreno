import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../../plugins";

export type WebhookReceiptMethods = Record<string, never>;

export interface WebhookReceiptStatics
  extends FindExactlyOnePlugin<WebhookReceiptDocument>,
    FindOneOrNonePlugin<WebhookReceiptDocument> {}

export interface WebhookReceiptModel
  extends mongoose.Model<WebhookReceiptDocument, object, WebhookReceiptMethods>,
    WebhookReceiptStatics {}

export interface WebhookReceiptDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  created: Date;
  eventId: string;
  source: string;
}
