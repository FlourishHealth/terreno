import type {APIErrorConstructor} from "@terreno/api";
import type mongoose from "mongoose";
import type {Document, FilterQuery, Model} from "mongoose";

/**
 * Interface that models can extend to include all the methods and properties
 * added by the default plugins (createdUpdatedPlugin, isDeletedPlugin, etc.)
 */
export interface DefaultStatics<T> {
  // Static methods from plugins
  findOneOrNone(
    query: FilterQuery<T>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<(Document & T) | null>;

  findExactlyOne(
    query: FilterQuery<T>,
    errorArgs?: Partial<APIErrorConstructor>
  ): Promise<Document & T>;

  // biome-ignore lint/suspicious/noExplicitAny: TODO Need to tighten up any
  upsert(conditions: Record<string, any>, update: Record<string, any>): Promise<T>;
}

/**
 * Interface for document properties added by default plugins
 */
export interface DefaultPluginFields {
  // From createdUpdatedPlugin
  created: Date;
  updated: Date;

  // From isDeletedPlugin
  deleted: boolean;
}

/**
 * Complete type that combines both static methods and document fields
 * that models get from the default plugins
 */
export type DefaultModel<T> = Model<T & DefaultPluginFields> & DefaultStatics<T>;
export type DefaultDoc = mongoose.Document<mongoose.Types.ObjectId> & DefaultPluginFields;
