import {beforeEach, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {APIError} from "../errors";
import {setupDb} from "../tests";
import {runDownMigrations, runMigrations} from "./runner";
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

describe("runDownMigrations", () => {
  beforeEach(async () => {
    await setupDb();
    await collection().deleteMany({});
  });

  it("rolls back the last applied migration and deletes history", async () => {
    const events: string[] = [];
    const migrations: LoadedMigration[] = [
      {
        checksum: "one",
        down: async () => {
          events.push("down-a");
        },
        id: "20260910120000-a",
        up: async () => {
          events.push("up-a");
        },
      },
      {
        checksum: "two",
        down: async () => {
          events.push("down-b");
        },
        id: "20260910120001-b",
        up: async () => {
          events.push("up-b");
        },
      },
    ];

    await runMigrations({
      connection: mongoose.connection,
      dryRun: false,
      migrations,
      mongoose,
    });
    const result = await runDownMigrations({
      connection: mongoose.connection,
      dryRun: false,
      migrations,
      mongoose,
      steps: 1,
    });

    expect(result.reversed).toEqual(["20260910120001-b"]);
    expect(events).toEqual(["up-a", "up-b", "down-b"]);
    expect(await appliedIds()).toEqual(["20260910120000-a"]);
  });

  it("does not delete history on dry-run down", async () => {
    const migrations: LoadedMigration[] = [
      {
        checksum: "dry-down",
        down: async (ctx) => {
          expect(ctx.dryRun).toBe(true);
        },
        id: "20260910120000-dry-down",
        up: async () => undefined,
      },
    ];
    await runMigrations({
      connection: mongoose.connection,
      dryRun: false,
      migrations,
      mongoose,
    });

    const result = await runDownMigrations({
      connection: mongoose.connection,
      dryRun: true,
      migrations,
      mongoose,
      steps: 1,
    });

    expect(result.reversed).toEqual(["20260910120000-dry-down"]);
    expect(await appliedIds()).toEqual(["20260910120000-dry-down"]);
  });

  it("throws when the target migration has no down", async () => {
    const migrations: LoadedMigration[] = [
      {
        checksum: "irreversible",
        id: "20260910120000-irreversible",
        up: async () => undefined,
      },
    ];
    await runMigrations({
      connection: mongoose.connection,
      dryRun: false,
      migrations,
      mongoose,
    });

    await expect(
      runDownMigrations({
        connection: mongoose.connection,
        dryRun: false,
        migrations,
        mongoose,
        steps: 1,
      })
    ).rejects.toThrow("has no down");
    expect(await appliedIds()).toEqual(["20260910120000-irreversible"]);
  });

  it("stops before up when checkCancellation rejects", async () => {
    let ran = false;
    await expect(
      runMigrations({
        checkCancellation: async () => {
          throw new APIError({status: 409, title: "Task was cancelled"});
        },
        connection: mongoose.connection,
        dryRun: false,
        migrations: [
          makeMigration({
            checksum: "cancel",
            id: "20260910120000-cancel",
            up: async () => {
              ran = true;
            },
          }),
        ],
        mongoose,
      })
    ).rejects.toThrow("cancelled");
    expect(ran).toBe(false);
    expect(await appliedIds()).toEqual([]);
  });
});
