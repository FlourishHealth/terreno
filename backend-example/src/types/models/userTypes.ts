/// <reference types="passport-local-mongoose" />

import type {GitHubProfile} from "@terreno/api";
import type mongoose from "mongoose";
import type {DefaultDoc, DefaultModel, DefaultStatics} from "../modelPlugins";

export type UserMethods = {
  getDisplayName: (this: UserDocument) => string;
};

export type UserStatics = DefaultStatics<UserDocument> & {
  findByEmail: (this: UserModel, email: string) => Promise<UserDocument | null>;
  /**
   * Find or create a user from GitHub OAuth profile.
   * This is called by the GitHub OAuth strategy during authentication.
   */
  findOrCreateFromGitHub: (
    this: UserModel,
    profile: GitHubProfile,
    accessToken: string
  ) => Promise<UserDocument>;
};

export type UserModel = DefaultModel<UserDocument> &
  UserStatics &
  mongoose.PassportLocalModel<UserDocument>;

export type UserSchema = mongoose.Schema<UserDocument, UserModel, UserMethods>;

export type UserDocument = DefaultDoc &
  UserMethods &
  mongoose.PassportLocalDocument & {
    admin: boolean;
    email: string;
    name: string;
    /**
     * GitHub user ID for OAuth-linked accounts.
     */
    githubId?: string;
    /**
     * GitHub username for OAuth-linked accounts.
     */
    githubUsername?: string;
  };
