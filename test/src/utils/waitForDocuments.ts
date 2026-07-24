import type {FilterQuery, Model} from "mongoose";

export interface WaitForDocumentsOptions {
  timeoutMs?: number;
  intervalMs?: number;
  sort?: Record<string, 1 | -1>;
}

/**
 * Polls until at least `count` documents match the query.
 * Useful when writes are asynchronous (audit logs, webhooks, etc.).
 */
export const waitForDocuments = async <T>(
  model: Model<T>,
  query: FilterQuery<T>,
  count = 1,
  {timeoutMs = 5000, intervalMs = 100, sort}: WaitForDocumentsOptions = {}
): Promise<T[]> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    let q = model.find(query);
    if (sort) {
      q = q.sort(sort);
    }
    const documents = await q.exec();
    if (documents.length >= count) {
      return documents;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const found = await model.countDocuments(query);
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for ${count} document(s) on ${model.modelName} matching ${JSON.stringify(query)} (found ${found})`
  );
};

/** Polls until a single document matches the query. */
export const waitForDocument = async <T>(
  model: Model<T>,
  query: FilterQuery<T>,
  options: WaitForDocumentsOptions = {}
): Promise<T> => {
  const results = await waitForDocuments(model, query, 1, options);
  return results[0];
};
