import {afterEach, describe, expect, it} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {
  listModelExcerptFiles,
  type MongooseDb,
  missingMongoUriMessage,
  resolveBackendEnvPaths,
  resolveModelDirs,
  resolveMongoUri,
  unwrapMongoose,
  withMongooseDb,
} from "./mongoEnv.js";

const URI_KEYS = ["MONGO_URI", "MONGODB_URI", "MONGO_URL"] as const;

describe("mongoEnv", () => {
  let projectRoot: string;
  let previousProjectRoot: string | undefined;
  const previousUris: Record<string, string | undefined> = {};

  const isolateEnv = (): void => {
    previousProjectRoot = process.env.TERRENO_PROJECT_ROOT;
    for (const key of URI_KEYS) {
      previousUris[key] = process.env[key];
      Reflect.deleteProperty(process.env, key);
    }
    projectRoot = mkdtempSync(join(tmpdir(), "terreno-mongo-env-"));
    process.env.TERRENO_PROJECT_ROOT = projectRoot;
  };

  const restoreEnv = (): void => {
    rmSync(projectRoot, {force: true, recursive: true});
    if (previousProjectRoot === undefined) {
      Reflect.deleteProperty(process.env, "TERRENO_PROJECT_ROOT");
    } else {
      process.env.TERRENO_PROJECT_ROOT = previousProjectRoot;
    }
    for (const key of URI_KEYS) {
      const prior = previousUris[key];
      if (prior === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = prior;
      }
    }
  };

  describe("resolveMongoUri", () => {
    afterEach(restoreEnv);

    it("reads MONGO_URI from example-backend/.env", (): void => {
      isolateEnv();
      mkdirSync(join(projectRoot, "example-backend"), {recursive: true});
      writeFileSync(
        join(projectRoot, "example-backend", ".env"),
        "MONGO_URI=mongodb://127.0.0.1:27017/from-example\n"
      );
      expect(resolveMongoUri()).toBe("mongodb://127.0.0.1:27017/from-example");
    });

    it("reads MONGO_URI from backend/.env", (): void => {
      isolateEnv();
      mkdirSync(join(projectRoot, "backend"), {recursive: true});
      writeFileSync(
        join(projectRoot, "backend", ".env"),
        'MONGO_URI="mongodb://127.0.0.1:27017/from-backend"\n'
      );
      expect(resolveMongoUri()).toBe("mongodb://127.0.0.1:27017/from-backend");
    });

    it("prefers process env over dotenv files", (): void => {
      isolateEnv();
      mkdirSync(join(projectRoot, "example-backend"), {recursive: true});
      writeFileSync(join(projectRoot, "example-backend", ".env"), "MONGO_URI=mongodb://file\n");
      process.env.MONGO_URI = "mongodb://process";
      expect(resolveMongoUri()).toBe("mongodb://process");
    });

    it("returns undefined when nothing is configured", (): void => {
      isolateEnv();
      expect(resolveMongoUri()).toBeUndefined();
      expect(missingMongoUriMessage()).toContain("example-backend/.env");
    });
  });

  describe("resolveModelDirs", () => {
    afterEach(restoreEnv);

    it("finds example-backend/src/models", (): void => {
      isolateEnv();
      mkdirSync(join(projectRoot, "example-backend", "src", "models"), {recursive: true});
      expect(resolveModelDirs()).toEqual([join(projectRoot, "example-backend", "src", "models")]);
    });
  });

  describe("listModelExcerptFiles", () => {
    afterEach(restoreEnv);

    it("skips index.ts", (): void => {
      isolateEnv();
      const modelsDir = join(projectRoot, "example-backend", "src", "models");
      mkdirSync(modelsDir, {recursive: true});
      writeFileSync(join(modelsDir, "todo.ts"), "export {};\n");
      writeFileSync(join(modelsDir, "index.ts"), "export {};\n");
      expect(listModelExcerptFiles(modelsDir)).toEqual(["todo.ts"]);
    });

    it("returns [] when the directory is missing", (): void => {
      isolateEnv();
      expect(listModelExcerptFiles(join(projectRoot, "missing"))).toEqual([]);
    });
  });

  describe("resolveBackendEnvPaths", () => {
    afterEach(restoreEnv);

    it("lists existing backend env files", (): void => {
      isolateEnv();
      mkdirSync(join(projectRoot, "example-backend"), {recursive: true});
      writeFileSync(join(projectRoot, "example-backend", ".env"), "MONGO_URI=mongodb://x\n");
      expect(resolveBackendEnvPaths()).toEqual([join(projectRoot, "example-backend", ".env")]);
    });
  });

  describe("unwrapMongoose", () => {
    it("uses a namespace that already has connection", (): void => {
      const fake = {
        connect: async (): Promise<void> => undefined,
        connection: {readyState: 1},
        disconnect: async (): Promise<void> => undefined,
      };
      expect(unwrapMongoose(fake)).toBe(fake);
    });

    it("unwraps Bun/ESM default export", (): void => {
      const inner = {
        connect: async (): Promise<void> => undefined,
        connection: {readyState: 0},
        disconnect: async (): Promise<void> => undefined,
      };
      expect(unwrapMongoose({default: inner})).toBe(inner);
    });

    it("unwraps nested default.default CJS interop", (): void => {
      const inner = {
        connect: async (): Promise<void> => undefined,
        connection: {readyState: 0},
        disconnect: async (): Promise<void> => undefined,
      };
      expect(unwrapMongoose({default: {default: inner}})).toBe(inner);
    });

    it("throws when connection is missing", (): void => {
      expect(() => unwrapMongoose({default: {}})).toThrow(/ESM\/CJS interop/);
    });

    it("unwraps the real mongoose package", async (): Promise<void> => {
      const mongoose = unwrapMongoose(await import("mongoose"));
      expect(mongoose.connection).toBeDefined();
      expect(typeof mongoose.connect).toBe("function");
    });
  });

  describe("withMongooseDb", () => {
    afterEach(restoreEnv);

    it("returns the missing-URI message", async (): Promise<void> => {
      isolateEnv();
      const result = await withMongooseDb(async () => "ok");
      expect(result).toContain("No Mongo URI found");
    });

    it("connects when readyState is not 1 and disconnects after", async (): Promise<void> => {
      isolateEnv();
      process.env.MONGO_URI = "mongodb://127.0.0.1:27017/fake";
      const fakeDb = {name: "fake"} as unknown as MongooseDb;
      let connected = false;
      let disconnected = false;
      const result = await withMongooseDb(
        async (db) => {
          expect(db).toBe(fakeDb);
          return "ok";
        },
        async () => ({
          connect: async (): Promise<void> => {
            connected = true;
          },
          connection: {db: fakeDb, readyState: 0},
          disconnect: async (): Promise<void> => {
            disconnected = true;
          },
        })
      );
      expect(result).toBe("ok");
      expect(connected).toBe(true);
      expect(disconnected).toBe(true);
    });

    it("skips connect when already connected", async (): Promise<void> => {
      isolateEnv();
      process.env.MONGO_URI = "mongodb://127.0.0.1:27017/fake";
      const fakeDb = {name: "ready"} as unknown as MongooseDb;
      let connected = false;
      const result = await withMongooseDb(
        async () => "ready",
        async () => ({
          connect: async (): Promise<void> => {
            connected = true;
          },
          connection: {db: fakeDb, readyState: 1},
          disconnect: async (): Promise<void> => undefined,
        })
      );
      expect(result).toBe("ready");
      expect(connected).toBe(false);
    });

    it("returns a message when connection.db is missing", async (): Promise<void> => {
      isolateEnv();
      process.env.MONGO_URI = "mongodb://127.0.0.1:27017/fake";
      const result = await withMongooseDb(
        async () => "ok",
        async () => ({
          connect: async (): Promise<void> => undefined,
          connection: {readyState: 1},
          disconnect: async (): Promise<void> => undefined,
        })
      );
      expect(result).toContain("connection.db");
    });
  });
});
