import {existsSync, readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import type {Connection} from "mongoose";

import {resolveTerrenoProjectRoot} from "./projectRoot.js";

export type MongooseDb = NonNullable<Connection["db"]>;

const URI_ENV_KEYS = ["MONGO_URI", "MONGODB_URI", "MONGO_URL"] as const;

const BACKEND_DIR_NAMES = ["backend", "example-backend"] as const;

export const readDotEnvValue = (envPath: string, key: string): string | undefined => {
  if (!existsSync(envPath)) {
    return undefined;
  }
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const k = trimmed.slice(0, eq).trim();
    if (k !== key) {
      continue;
    }
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
};

const firstProcessEnvUri = (): string | undefined => {
  for (const key of URI_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
};

const envFileCandidates = (root: string): string[] => {
  return [...BACKEND_DIR_NAMES.map((dir) => join(root, dir, ".env")), join(root, ".env")];
};

/** Bootstrap apps use `backend/`; this monorepo uses `example-backend/`. */
export const resolveBackendEnvPaths = (root = resolveTerrenoProjectRoot()): string[] => {
  return envFileCandidates(root).filter((path) => existsSync(path));
};

export const resolveModelDirs = (root = resolveTerrenoProjectRoot()): string[] => {
  return BACKEND_DIR_NAMES.map((dir) => join(root, dir, "src", "models")).filter((path) =>
    existsSync(path)
  );
};

export const listModelExcerptFiles = (modelsDir: string): string[] => {
  if (!existsSync(modelsDir)) {
    return [];
  }
  return readdirSync(modelsDir).filter((name) => name.endsWith(".ts") && name !== "index.ts");
};

const MISSING_URI_MESSAGE =
  "No Mongo URI found. Set `MONGO_URI` in `backend/.env` or `example-backend/.env`, export `MONGO_URI`, or set `TERRENO_PROJECT_ROOT`.";

export const missingMongoUriMessage = (): string => MISSING_URI_MESSAGE;

/**
 * Process env wins, then the first matching key in `backend/.env`,
 * `example-backend/.env`, or repo-root `.env`.
 */
export const resolveMongoUri = (root = resolveTerrenoProjectRoot()): string | undefined => {
  const fromEnv = firstProcessEnvUri();
  if (fromEnv) {
    return fromEnv;
  }
  for (const envPath of envFileCandidates(root)) {
    for (const key of URI_ENV_KEYS) {
      const value = readDotEnvValue(envPath, key);
      if (value) {
        return value;
      }
    }
  }
  return undefined;
};

export interface MongooseLike {
  connect: (uri: string) => Promise<unknown>;
  connection: {db?: MongooseDb; readyState: number};
  disconnect: () => Promise<unknown>;
}

export const unwrapMongoose = (imported: unknown): MongooseLike => {
  let current: unknown = imported;
  for (let i = 0; i < 4; i += 1) {
    if (
      current &&
      typeof current === "object" &&
      "connection" in current &&
      (current as MongooseLike).connection
    ) {
      return current as MongooseLike;
    }
    if (current && typeof current === "object" && "default" in current) {
      current = (current as {default: unknown}).default;
      continue;
    }
    break;
  }
  throw new Error("mongoose import has no connection (ESM/CJS interop failed)");
};

export const withMongooseDb = async <T>(
  fn: (db: MongooseDb) => Promise<T>,
  importMongoose: () => Promise<unknown> = async () => import("mongoose")
): Promise<T | string> => {
  const mongoUri = resolveMongoUri();
  if (!mongoUri) {
    return missingMongoUriMessage();
  }
  const mongoose = unwrapMongoose(await importMongoose());
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri);
    }
    const db = mongoose.connection.db;
    if (!db) {
      return "Connected to Mongo but `connection.db` is not available.";
    }
    return await fn(db);
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
};
