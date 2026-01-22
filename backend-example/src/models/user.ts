import {type GitHubProfile, getGitHubPrimaryEmail} from "@terreno/api";
import mongoose from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import type {UserDocument, UserModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

const userSchema = new mongoose.Schema<UserDocument, UserModel>(
  {
    admin: {
      default: false,
      type: Boolean,
    },
    email: {
      lowercase: true,
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    githubId: {
      index: true,
      sparse: true,
      type: String,
      unique: true,
    },
    githubUsername: {
      type: String,
    },
    name: {
      required: true,
      trim: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

// Add passport-local-mongoose plugin
userSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});

addDefaultPlugins(userSchema);

// Define methods (use .method() to avoid overwriting passport-local-mongoose methods)
userSchema.method("getDisplayName", function (this: UserDocument): string {
  return this.name;
});

export const User = mongoose.model<UserDocument, UserModel>("User", userSchema);

// Define custom statics after model creation
User.findByEmail = async function (email: string): Promise<UserDocument | null> {
  return this.findOneOrNone({email: email.toLowerCase()});
};

/**
 * Find or create a user from GitHub OAuth profile.
 * If a user with the same GitHub ID exists, returns that user.
 * If a user with the same email exists, links the GitHub account.
 * Otherwise, creates a new user.
 */
User.findOrCreateFromGitHub = async function (
  profile: GitHubProfile,
  _accessToken: string
): Promise<UserDocument> {
  // First, try to find by GitHub ID
  let user = await this.findOneOrNone({githubId: profile.id});
  if (user) {
    // Update GitHub username if it changed
    if (user.githubUsername !== profile.username) {
      user.githubUsername = profile.username;
      await user.save();
    }
    return user;
  }

  // Try to find by email and link the GitHub account
  const email = getGitHubPrimaryEmail(profile);
  if (email) {
    user = await this.findOneOrNone({email: email.toLowerCase()});
    if (user) {
      user.githubId = profile.id;
      user.githubUsername = profile.username;
      await user.save();
      return user;
    }
  }

  // Create a new user
  if (!email) {
    throw new Error(
      "GitHub profile does not have an email address. Please make your email public on GitHub or use a different login method."
    );
  }

  const newUser = new this({
    email: email.toLowerCase(),
    githubId: profile.id,
    githubUsername: profile.username,
    name: profile.displayName || profile.username,
  });

  await newUser.save();
  return newUser;
};
