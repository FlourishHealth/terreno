import type mongoose from "mongoose";
import type {
  PassportLocalMongooseDocument,
  PassportLocalMongooseModel,
} from "passport-local-mongoose";
import type {DefaultDoc, DefaultModel, DefaultStatics} from "../modelPlugins";

export type UserMethods = {
  getDisplayName: (this: UserDocument) => string;
};

export type UserStatics = DefaultStatics<UserDocument> & {
  findByEmail: (this: UserModel, email: string) => Promise<UserDocument | null>;
};

export type UserModel = DefaultModel<UserDocument> &
  UserStatics &
  PassportLocalMongooseModel<UserDocument>;

export type UserSchema = mongoose.Schema<UserDocument, UserModel, UserMethods>;

export type UserDocument = DefaultDoc &
  UserMethods &
  PassportLocalMongooseDocument & {
    admin: boolean;
    betterAuthId?: string;
    email: string;
    name: string;
    oauthProvider?: "google" | "github" | "apple" | null;
    organizationIds: string[];
    emailVerified: boolean;
    tokenEpoch: number;
  };
