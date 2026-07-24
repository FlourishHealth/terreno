import mongoose from "mongoose";

/** Ensures all registered Mongoose model indexes exist on the database. */
export const ensureAllIndexes = async (): Promise<void> => {
  const models = Object.keys(mongoose.models);
  const indexPromises: Array<Promise<unknown>> = [];
  for (const modelName of models) {
    indexPromises.push(mongoose.models[modelName].createIndexes());
  }
  await Promise.all(indexPromises);
};
