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

/** Snapshot of the Todo model at this file; later `generate` diffs against it. */
export const schemaAfter = {
  models: {
    Todo: {
      collection: "todos",
      fields: [
        {instance: "String", path: "_syncPrevStream", required: false, unique: false},
        {instance: "Number", path: "_syncSeq", required: false, unique: false},
        {instance: "Boolean", path: "completed", required: false, unique: false},
        {instance: "Date", path: "created", required: false, unique: false},
        {instance: "Boolean", path: "deleted", required: false, unique: false},
        {instance: "ObjectId", path: "ownerId", required: true, unique: false},
        {instance: "String", path: "priority", required: false, unique: false},
        {instance: "Array", path: "tags", required: false, unique: false},
        {instance: "String", path: "title", required: true, unique: false},
        {instance: "Date", path: "updated", required: false, unique: false},
      ],
      indexes: [
        {keys: {_syncSeq: 1}, unique: false},
        {keys: {created: 1}, unique: false},
        {keys: {deleted: 1}, unique: false},
        {keys: {updated: 1}, unique: false},
      ],
      modelName: "Todo",
    },
  },
};
