import mongoose, {type Model} from "mongoose";

import {addPopulateToQuery} from "./api";
import {APIError, errorDetail, isAPIError, NotFoundError} from "./errors";
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
    builtQuery as unknown as Parameters<typeof addPopulateToQuery>[0],
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
      cause: error,
      code: "get-error",
      detail: `GET failed on ${id}: ${errorDetail(error)}`,
      meta: {model: model.modelName},
      status: 500,
      title: "GET error",
    });
  }
  if (!data) {
    const hiddenDoc = await model.collection.findOne({
      _id: new mongoose.Types.ObjectId(id),
    });

    const notFoundDetail = `Document ${id} not found for model ${model.modelName}`;

    if (!hiddenDoc) {
      throw new NotFoundError({
        code: "document-not-found",
        detail: notFoundDetail,
        title: "Document not found",
      });
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
      throw new NotFoundError({
        code: "document-not-found",
        detail: notFoundDetail,
        title: "Document not found",
      });
    }
    throw new NotFoundError({
      code: "document-not-found",
      detail: notFoundDetail,
      disableExternalErrorTracking: true,
      meta: reason,
      title: "Document not found",
    });
  }

  return data;
};
