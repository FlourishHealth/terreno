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

// Define methods
userSchema.methods = {
	getDisplayName(this: UserDocument): string {
		return this.name;
	},
};

export const User = mongoose.model<UserDocument, UserModel>("User", userSchema);

// Define custom statics after model creation
User.findByEmail = async function (email: string): Promise<UserDocument | null> {
	return this.findOneOrNone({email: email.toLowerCase()});
};
