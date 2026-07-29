import mongoose from "mongoose";

import {testLogger} from "../logging/testLogger";

export const DEFAULT_LOCAL_MONGO_URI = "mongodb://127.0.0.1/terreno?&connectTimeoutMS=360000";

export interface SplitMongoUriResult {
  baseUri: string;
  uriOptions: string;
}

export const splitMongoUri = (uri: string): SplitMongoUriResult => {
  const [uriWithoutQuery, query] = uri.split("?");
  const lastSlashIndex = uriWithoutQuery.lastIndexOf("/");
  const baseUri =
    lastSlashIndex > "mongodb://".length
      ? uriWithoutQuery.slice(0, lastSlashIndex)
      : uriWithoutQuery;
  const uriOptions = query ? `?${query}` : "";
  return {baseUri, uriOptions};
};

export const buildDatabaseUri = ({
  uri,
  databaseName,
}: {
  uri: string;
  databaseName: string;
}): string => {
  const [uriWithoutQuery, queryParams] = uri.split("?");
  const normalizedUri = uriWithoutQuery.endsWith("/") ? uriWithoutQuery : `${uriWithoutQuery}/`;
  if (queryParams) {
    return `${normalizedUri}${databaseName}?${queryParams}`;
  }
  return `${normalizedUri}${databaseName}`;
};

export interface EnsureTestMongooseConnectedOptions {
  defaultUri?: string;
  onConnectError?: (error: unknown) => void;
}

/** Ensures Mongoose is connected without replacing an existing test connection. */
export const ensureTestMongooseConnected = async (
  options: EnsureTestMongooseConnectedOptions = {}
): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
    return;
  }

  const uri =
    process.env.TERRENO_TEST_MONGODB_URI?.trim() || options.defaultUri || DEFAULT_LOCAL_MONGO_URI;
  try {
    await mongoose.connect(uri);
  } catch (error) {
    if (options.onConnectError) {
      options.onConnectError(error);
      return;
    }
    testLogger.catch(error);
  }
};
