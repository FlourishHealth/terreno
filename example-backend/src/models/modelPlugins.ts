import {
  createdUpdatedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
  upsertPlugin,
} from "@terreno/api";
import type mongoose from "mongoose";

// noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
// biome-ignore lint/suspicious/noExplicitAny: Schema generics must be loose to accept arbitrary consumer schemas
export const addDefaultPlugins = (schema: mongoose.Schema<any, any, any, any>): void => {
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(isDeletedPlugin);
  schema.plugin(findOneOrNone);
  schema.plugin(findExactlyOne);
  schema.plugin(upsertPlugin);
};
