import * as Sentry from "@sentry/bun";
import mongoose, {type Model} from "mongoose";

import {addPopulateToQuery} from "./api";
import {APIError, isAPIError} from "./errors";
import type {PopulatePath} from "./populate";

/**
 * Loads a document by id or throws a 404 APIError.
 * Matches permission middleware behavior including soft-delete metadata.
 */
export const loadDocOr404 = async <T>(
  model: Model<T>,
  id: string,
  populatePaths?: PopulatePath[]
): Promise<T> => {
  const builtQuery = model.findById(id);
  const populatedQuery = addPopulateToQuery(
    // biome-ignore lint/suspicious/noExplicitAny: Query types vary based on populate paths
    builtQuery as any,
    populatePaths
  );
  let data: T | null;
  try {
    data = (await populatedQuery.exec()) as T | null;
  } catch (error: unknown) {
    if (isAPIError(error)) {
      throw error;
    }
    throw new APIError({
      error: error as Error,
      status: 500,
      title: `GET failed on ${id}`,
    });
  }
  if (!data) {
    const hiddenDoc = await model.collection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });

    if (!hiddenDoc) {
      Sentry.captureMessage(`Document ${id} not found for model ${model.modelName}`);
      const error = new APIError({
        status: 404,
        title: `Document ${id} not found for model ${model.modelName}`,
      });
      error.meta = undefined;
      throw error;
    }

    let reason: {[key: string]: string} | null = null;
    if (hiddenDoc.deleted) {
      reason = {deleted: "true"};
    } else if (hiddenDoc.disabled) {
      reason = {disabled: "true"};
    } else if (hiddenDoc.archived) {
      reason = {archived: "true"};
    }

    if (!reason) {
      const error = new APIError({
        status: 404,
        title: `Document ${id} not found for model ${model.modelName}`,
      });
      error.meta = undefined;
      throw error;
    }
    throw new APIError({
      disableExternalErrorTracking: true,
      meta: reason,
      status: 404,
      title: `Document ${id} not found for model ${model.modelName}`,
    });
  }

  return data;
};
