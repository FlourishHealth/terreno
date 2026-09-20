import type mongoose from "mongoose";
import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "../plugins";

export type MembershipRoleName = "org-admin" | "member";
export type MembershipStatus = "active" | "suspended";

// biome-ignore lint/complexity/noBannedTypes: No instance methods.
export type MembershipMethods = {};

export interface MembershipStatics
  extends FindExactlyOnePlugin<MembershipDocument>,
    FindOneOrNonePlugin<MembershipDocument> {
  findActiveForUser: (
    this: MembershipModel,
    userId: mongoose.Types.ObjectId | string
  ) => Promise<MembershipDocument[]>;
  isMember: (
    this: MembershipModel,
    userId: mongoose.Types.ObjectId | string,
    organizationId: mongoose.Types.ObjectId | string
  ) => Promise<boolean>;
  isOrgAdmin: (
    this: MembershipModel,
    userId: mongoose.Types.ObjectId | string,
    organizationId: mongoose.Types.ObjectId | string
  ) => Promise<boolean>;
}

export interface MembershipModel
  extends mongoose.Model<MembershipDocument, object, MembershipMethods>,
    MembershipStatics {}

export type MembershipSchema = mongoose.Schema<
  MembershipDocument,
  MembershipModel,
  MembershipMethods
>;

export interface MembershipDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  created: Date;
  deleted: boolean;
  organizationId: mongoose.Types.ObjectId;
  roleName: MembershipRoleName;
  status: MembershipStatus;
  updated: Date;
  userId: mongoose.Types.ObjectId;
}
