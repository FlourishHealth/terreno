import {ObjectId} from "mongodb";
import mongoose from "mongoose";

import {logger} from "./logger";

// A better version of mongoose's ObjectId.isValid,
// which falsely will say any 12 character string is valid.
export function isValidObjectId(id: string): boolean {
  try {
    return new ObjectId(id).toString() === id;
  } catch (error) {
    logger.error(`Error validating object id ${id}: ${error}`);
    return false;
  }
}

export const timeout = async (ms: number): Promise<NodeJS.Timeout> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Ensure that all mongoose models are set to strict mode.
 * This validates that models will throw errors when attempting to set
 * properties that aren't defined in the schema.
 *
 * @param ignoredModels - Array of model names to skip validation for
 * @throws Error if any model is not set to strict mode or missing virtual settings
 */
export function checkModelsStrict(ignoredModels: string[] = []): void {
  const models = mongoose.modelNames();
  for (const model of models) {
    const schema = mongoose.model(model).schema;

    if (schema.get("toObject")?.virtuals !== true) {
      throw new Error(`Model ${model} toObject.virtuals not set to true`);
    }
    if (schema.get("toJSON")?.virtuals !== true) {
      throw new Error(`Model ${model} toJSON.virtuals not set to true`);
    }

    if (ignoredModels.includes(model)) {
      continue;
    }
    if (schema.get("strict") !== "throw") {
      throw new Error(`Model ${model} is not set to strict mode.`);
    }
  }
}
