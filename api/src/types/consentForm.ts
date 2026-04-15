import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

export interface ConsentFormCheckbox {
  label: string;
  required: boolean;
  confirmationPrompt?: string;
}

export type ConsentFormType = "agreement" | "privacy" | "hipaa" | "research" | "terms" | "custom";

export type ConsentFormMethods = Record<keyof any, never>;

export interface ConsentFormStatics
  extends FindExactlyOnePlugin<ConsentFormDocument>,
    FindOneOrNonePlugin<ConsentFormDocument> {}

export interface ConsentFormModel
  extends mongoose.Model<ConsentFormDocument, object, ConsentFormMethods>,
    ConsentFormStatics {}

export interface ConsentFormDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  version: number;
  order: number;
  type: ConsentFormType;
  content: Map<string, string>;
  defaultLocale: string;
  active: boolean;
  captureSignature: boolean;
  requireScrollToBottom: boolean;
  checkboxes: ConsentFormCheckbox[];
  agreeButtonText: string;
  allowDecline: boolean;
  declineButtonText: string;
  required: boolean;
  created: Date;
  updated: Date;
  deleted: boolean;
}
