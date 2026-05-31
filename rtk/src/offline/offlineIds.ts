import {DateTime} from "luxon";

/** Generates a MongoDB-compatible 24-character hex ObjectId string. */
export const generateObjectId = (): string => {
  const timestamp = Math.floor(DateTime.now().toSeconds()).toString(16).padStart(8, "0");
  const random = Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16)).join(
    ""
  );
  return `${timestamp}${random}`.slice(0, 24);
};

export const isObjectIdShape = (value: string): boolean => {
  return /^[a-f0-9]{24}$/i.test(value);
};

export interface OfflineIdStrategyOptions {
  generateId?: () => string;
  requestField?: string;
}

export const resolveOfflineIdStrategy = (
  options?: OfflineIdStrategyOptions
): Required<Pick<OfflineIdStrategyOptions, "generateId" | "requestField">> => {
  return {
    generateId: options?.generateId ?? generateObjectId,
    requestField: options?.requestField ?? "_id",
  };
};
