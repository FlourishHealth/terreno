import type {APIErrorConstructor} from "@terreno/api";
import type mongoose from "mongoose";
import type {Document, Model} from "mongoose";

type ModelQuery<T> = Partial<Record<keyof T, unknown>> & Record<string, unknown>;

export interface DefaultStatics<T> {
  findOneOrNone(
    query: ModelQuery<T>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<(Document & T) | null>;

  findExactlyOne(
    query: ModelQuery<T>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<Document & T>;
}

export interface DefaultPluginFields {
  created: Date;
  updated: Date;
  deleted: boolean;
}

export type DefaultModel<T> = Model<T & DefaultPluginFields> & DefaultStatics<T>;
export type DefaultDoc = mongoose.Document<mongoose.Types.ObjectId> & DefaultPluginFields;

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
    email: string;
    name: string;
  };
