import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

// Base types for all models
export type BaseDocument = mongoose.Document & {
	_id: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
};

// User Model
export type UserMethods = {
	getDisplayName: (this: UserDocument) => string;
};

export type UserStatics = FindExactlyOnePlugin<UserDocument> &
	FindOneOrNonePlugin<UserDocument> & {
		findByEmail: (email: string) => Promise<UserDocument | null>;
	};

export type UserModel = mongoose.Model<UserDocument, object, UserMethods> & UserStatics;

export type UserDocument = BaseDocument &
	UserMethods & {
		email: string;
		name: string;
	};

// Add additional model interfaces below following the same pattern
