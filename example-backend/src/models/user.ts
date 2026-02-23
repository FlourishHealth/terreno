import mongoose from "mongoose";
import _passportLocalMongoose from "passport-local-mongoose";
import type {UserDocument, UserModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

// Handle bundling interop - bun build --compile wraps the export incorrectly
const passportLocalMongoose =
  typeof _passportLocalMongoose === "function"
    ? _passportLocalMongoose
    : // biome-ignore lint/suspicious/noExplicitAny: Passport Local Mongoose is a function, not an object.
      (_passportLocalMongoose as any).default;

const userSchema = new mongoose.Schema<UserDocument, UserModel>(
  {
    admin: {
      default: false,
      description: "Whether the user has admin privileges",
      type: Boolean,
    },
    betterAuthId: {
      index: true,
      sparse: true,
      type: String,
    },
    email: {
      description: "The user's email address, used for authentication",
      lowercase: true,
      required: true,
      trim: true,
      type: String,
      unique: true,
    },
    name: {
      description: "The user's display name",
      required: true,
      trim: true,
      type: String,
    },
    oauthProvider: {
      enum: ["google", "github", "apple", null],
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
