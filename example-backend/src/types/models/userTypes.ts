/// <reference types="passport-local-mongoose" />
import type mongoose from "mongoose";
import type {DefaultDoc, DefaultModel, DefaultStatics} from "../modelPlugins";

export type UserMethods = {
  getDisplayName: (this: UserDocument) => string;
};

export type UserStatics = DefaultStatics<UserDocument> & {
  findByEmail: (this: UserModel, email: string) => Promise<UserDocument | null>;
};

export type UserModel = DefaultModel<UserDocument> &
  UserStatics &
  mongoose.PassportLocalModel<UserDocument>;

export type UserSchema = mongoose.Schema<UserDocument, UserModel, UserMethods>;

export type UserDocument = DefaultDoc &
  UserMethods &
  mongoose.PassportLocalDocument & {
    admin: boolean;
    betterAuthId?: string;
    email: string;
    name: string;
    oauthProvider?: "google" | "github" | "apple" | null;
  };
