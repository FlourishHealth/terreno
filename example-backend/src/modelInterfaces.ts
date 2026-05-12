import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

// Base types for all models
export interface BaseDocument extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User Model
export interface UserMethods {
  getDisplayName: (this: UserDocument) => string;
}

export interface UserStatics
  extends FindExactlyOnePlugin<UserDocument>,
    FindOneOrNonePlugin<UserDocument> {
  findByEmail: (email: string) => Promise<UserDocument | null>;
}

export interface UserModel extends mongoose.Model<UserDocument, object, UserMethods>, UserStatics {}

export interface UserDocument extends BaseDocument, UserMethods {
  email: string;
  name: string;
}

// Add additional model interfaces below following the same pattern
