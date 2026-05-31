/**
 * In-memory MongoDB for local feature proof (stack:dev / proof:web).
 * Writes the connection URI to MEMORY_MONGO_URI_FILE and stays running until SIGTERM.
 */

import {writeFileSync} from "node:fs";
import {MongoMemoryServer} from "mongodb-memory-server";

const uriFile =
  process.env.MEMORY_MONGO_URI_FILE ??
  new URL("../../../.proof/memory-mongo.uri", import.meta.url).pathname;

const startMemoryMongo = async (): Promise<void> => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("terreno-local");

  writeFileSync(uriFile, uri, "utf8");
  console.info(`Memory MongoDB ready: ${uri}`);
  console.info(`URI written to ${uriFile}`);

  const shutdown = async (): Promise<void> => {
    await mongod.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
};

await startMemoryMongo();
