import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

// biome-ignore lint/complexity/noBannedTypes: No instance methods.
export type OrganizationMethods = {};

export interface OrganizationStatics
  extends FindExactlyOnePlugin<OrganizationDocument>,
    FindOneOrNonePlugin<OrganizationDocument> {}

export interface OrganizationModel
  extends mongoose.Model<OrganizationDocument, object, OrganizationMethods>,
    OrganizationStatics {}

export type OrganizationSchema = mongoose.Schema<
  OrganizationDocument,
  OrganizationModel,
  OrganizationMethods
>;

export interface OrganizationDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  created: Date;
  deleted: boolean;
  disabled: boolean;
  name: string;
  ownerId: mongoose.Types.ObjectId;
  settings?: Record<string, unknown>;
  slug: string;
  updated: Date;
}
