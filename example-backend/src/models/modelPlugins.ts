import {
  createdUpdatedPlugin,
  excludeArchivedPlugin,
  findExactlyOne,
  findOneOrNone,
  isDeletedPlugin,
  upsertPlugin,
} from "@terreno/api";
import type mongoose from "mongoose";

// Re-export the promoted plugins so existing imports from this module keep working. These now live
// in @terreno/api; import them from there directly in new code.
export {excludeArchivedPlugin, upsertPlugin};

// biome-ignore lint/suspicious/noExplicitAny: Leaving as open as possible.
export const addDefaultPlugins = (schema: mongoose.Schema<any, any, any, any>): void => {
  schema.plugin(createdUpdatedPlugin);
  schema.plugin(isDeletedPlugin);
  schema.plugin(findOneOrNone);
  schema.plugin(findExactlyOne);
  schema.plugin(upsertPlugin);
};
