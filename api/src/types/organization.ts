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

/**
 * App-defined `Organization.settings` shape.
 *
 * Augment in the consumer app:
 *
 * ```ts
 * declare module "@terreno/api" {
 *   interface OrganizationSettings {
 *     timezone?: string;
 *   }
 * }
 * ```
 *
 * Or pass a generic to `organizationSettingsOf<MySettings>(organization)`.
 */
// biome-ignore lint/suspicious/noEmptyInterface: Declaration merging for consumer settings.
export interface OrganizationSettings {}

export interface OrganizationDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  created: Date;
  deleted: boolean;
  disabled: boolean;
  name: string;
  ownerId: mongoose.Types.ObjectId;
  settings?: OrganizationSettings;
  slug: string;
  updated: Date;
}
