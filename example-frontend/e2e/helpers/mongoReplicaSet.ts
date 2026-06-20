import {MongoClient} from "mongodb";

const DEFAULT_URI = "mongodb://127.0.0.1/terreno-e2e";

/**
 * Change streams (used for feature-flag live updates) require MongoDB to run
 * as a replica set. `hello` includes `setName` when connected to a replset.
 */
export const mongoSupportsChangeStreams = async (
  mongoUri: string = process.env.MONGO_URI ?? DEFAULT_URI
): Promise<boolean> => {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const hello = (await client.db().admin().command({hello: 1})) as {setName?: string};
    return Boolean(hello.setName);
  } catch {
    return false;
  } finally {
    await client.close();
  }
};
