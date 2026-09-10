import {beforeEach, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {setupDb} from "../tests";
import {runMigrations} from "./runner";
import {type LoadedMigration, MIGRATION_LOCK_ID, MIGRATIONS_COLLECTION} from "./types";

const collection = (): mongoose.Collection => {
  return mongoose.connection.collection(MIGRATIONS_COLLECTION);
};

const appliedIds = async (): Promise<string[]> => {
  const docs = await collection()
    .find({_id: {$ne: MIGRATION_LOCK_ID}})
    .project({id: 1})
    .toArray();
  return docs.map((doc) => String(doc.id));
};

const makeMigration = ({
  id,
  checksum,
  up,
}: {
  id: string;
  checksum: string;
  up: LoadedMigration["up"];
}): LoadedMigration => {
  return {checksum, id, up};
};

describe("runMigrations", () => {
  beforeEach(async () => {
    await setupDb();
    await collection().deleteMany({});
  });

  it("calls up with dryRun true and does not record history", async () => {
    const seen: boolean[] = [];
    const migrations = [
      makeMigration({
        checksum: "aaa",
        id: "20260910120000-dry",
        up: async (ctx) => {
          seen.push(ctx.dryRun);
        },
      }),
    ];

    const result = await runMigrations({
      connection: mongoose.connection,
      dryRun: true,
      migrations,
      mongoose,
    });

    expect(result.dryRun).toBe(true);
    expect(result.applied).toEqual(["20260910120000-dry"]);
    expect(seen).toEqual([true]);
    expect(await appliedIds()).toEqual([]);
  });

  it("records checksum and appliedAt on a wet run", async () => {
    const migrations = [
      makeMigration({
        checksum: "bbb",
        id: "20260910120000-wet",
        up: async () => undefined,
      }),
    ];

    const result = await runMigrations({
      connection: mongoose.connection,
      dryRun: false,
      migrations,
      mongoose,
    });

    expect(result.applied).toEqual(["20260910120000-wet"]);
    expect(result.skipped).toEqual([]);
    const stored = await collection().findOne({_id: "20260910120000-wet"});
    expect(stored?.id).toBe("20260910120000-wet");
    expect(stored?.checksum).toBe("bbb");
    expect(stored?.appliedAt).toBeInstanceOf(Date);
  });

  it("skips already-applied ids on a second wet run", async () => {
    let calls = 0;
    const migrations = [
      makeMigration({
        checksum: "ccc",
        id: "20260910120000-once",
        up: async () => {
          calls += 1;
        },
      }),
    ];
    const options = {
      connection: mongoose.connection,
      dryRun: false,
      migrations,
      mongoose,
    };

    await runMigrations(options);
    const second = await runMigrations(options);

    expect(calls).toBe(1);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["20260910120000-once"]);
  });

  it("throws when an applied id has a different checksum", async () => {
    await runMigrations({
      connection: mongoose.connection,
      dryRun: false,
      migrations: [
        makeMigration({
          checksum: "original",
          id: "20260910120000-edit",
          up: async () => undefined,
        }),
      ],
      mongoose,
    });

    await expect(
      runMigrations({
        connection: mongoose.connection,
        dryRun: false,
        migrations: [
          makeMigration({
            checksum: "edited",
            id: "20260910120000-edit",
            up: async () => undefined,
          }),
        ],
        mongoose,
      })
    ).rejects.toThrow("checksum");
  });
});
