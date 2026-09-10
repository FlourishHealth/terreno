import type {MigrationContext} from "@terreno/api";

export const id = "20260910120000-todos-title-owner-index";

const INDEX_KEYS = {ownerId: 1, title: 1};
const INDEX_NAME = "ownerId_1_title_1";

export const up = async (ctx: MigrationContext): Promise<void> => {
  if (ctx.dryRun) {
    return;
  }
  await ctx.mongoose.connection.collection("todos").createIndex(INDEX_KEYS, {name: INDEX_NAME});
};

export const down = async (ctx: MigrationContext): Promise<void> => {
  if (ctx.dryRun) {
    return;
  }
  await ctx.mongoose.connection.collection("todos").dropIndex(INDEX_NAME);
};
