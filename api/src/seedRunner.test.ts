import {afterEach, describe, it} from "bun:test";
import {assert} from "chai";
import mongoose, {type Document, Schema} from "mongoose";

import {runSeedCli, runSeeds, type SeedStep} from "./seedRunner";

interface SeedWidgetDocument extends Document {
  key: string;
  label: string;
}

const seedWidgetSchema = new Schema<SeedWidgetDocument>({
  key: {description: "Stable seed key", required: true, type: String, unique: true},
  label: {description: "Seeded display label", required: true, type: String},
});
const SeedWidget =
  (mongoose.models.SeedRunnerWidget as mongoose.Model<SeedWidgetDocument> | undefined) ??
  mongoose.model<SeedWidgetDocument>("SeedRunnerWidget", seedWidgetSchema);

const widgetStep = (label: string): SeedStep => ({
  name: "widgets",
  reset: async (context) => {
    await context.deleteMany(SeedWidget);
  },
  run: async (context) => {
    await context.upsert(SeedWidget, {key: "primary"}, {label});
  },
});

afterEach(async () => {
  await SeedWidget.deleteMany({});
  process.env.NODE_ENV = "test";
});

describe("runSeeds", () => {
  it("creates, updates, and then leaves keyed seed data unchanged", async () => {
    const created = await runSeeds({name: "test", steps: [widgetStep("First")]});
    const updated = await runSeeds({name: "test", steps: [widgetStep("Second")]});
    const unchanged = await runSeeds({name: "test", steps: [widgetStep("Second")]});

    assert.equal(created.summary.created, 1);
    assert.equal(updated.summary.updated, 1);
    assert.equal(unchanged.summary.unchanged, 1);
    assert.equal((await SeedWidget.findOne({key: "primary"}))?.label, "Second");
  });

  it("previews sync and reset operations without writing", async () => {
    await SeedWidget.create({key: "primary", label: "Old"});

    const result = await runSeeds({
      dryRun: true,
      mode: "reset",
      name: "test",
      steps: [widgetStep("New")],
    });

    assert.equal(result.summary.deleted, 1);
    assert.equal(result.summary.updated, 1);
    assert.equal((await SeedWidget.findOne({key: "primary"}))?.label, "Old");
  });

  it("runs selected steps with dependencies in declared order", async () => {
    const calls: string[] = [];
    const steps: SeedStep[] = [
      {name: "users", run: async () => void calls.push("users")},
      {
        dependsOn: ["users"],
        name: "todos",
        run: async () => void calls.push("todos"),
      },
      {name: "flags", run: async () => void calls.push("flags")},
    ];

    const result = await runSeeds({name: "test", only: ["todos"], steps});

    assert.deepEqual(calls, ["users", "todos"]);
    assert.deepEqual(result.steps, ["users", "todos"]);
  });

  it("runs reset handlers in reverse dependency order before reseeding", async () => {
    const calls: string[] = [];
    const steps: SeedStep[] = [
      {
        name: "parents",
        reset: async () => void calls.push("reset parents"),
        run: async () => void calls.push("seed parents"),
      },
      {
        dependsOn: ["parents"],
        name: "children",
        reset: async () => void calls.push("reset children"),
        run: async () => void calls.push("seed children"),
      },
    ];

    await runSeeds({mode: "reset", name: "test", steps});

    assert.deepEqual(calls, ["reset children", "reset parents", "seed parents", "seed children"]);
  });

  it("blocks production resets unless forced and explicitly allowed", async () => {
    process.env.NODE_ENV = "production";

    await assert.isRejected(
      runSeeds({force: true, mode: "reset", name: "test", steps: []}),
      /Production seed reset is disabled/
    );
    const result = await runSeeds({
      allowProductionReset: true,
      force: true,
      mode: "reset",
      name: "test",
      steps: [],
    });
    assert.isTrue(result.success);
  });
});

describe("runSeedCli", () => {
  it("parses reset, dry-run, force, and repeated only options", async () => {
    const calls: string[] = [];
    const steps: SeedStep[] = [
      {
        name: "one",
        reset: async () => void calls.push("reset one"),
        run: async () => void calls.push("one"),
      },
      {name: "two", run: async () => void calls.push("two")},
    ];

    const cli = await runSeedCli({
      argv: ["--reset", "--dry-run", "--force", "--only", "one"],
      name: "bun run seed",
      steps,
    });

    assert.equal(cli.exitCode, 0);
    assert.equal(cli.result?.mode, "reset");
    assert.isTrue(cli.result?.dryRun);
    assert.deepEqual(calls, ["reset one", "one"]);
  });

  it("returns help without connecting and rejects unknown options", async () => {
    let didConnect = false;
    const help = await runSeedCli({
      argv: ["--help"],
      connect: async () => {
        didConnect = true;
      },
      name: "bun run seed",
      steps: [widgetStep("Example")],
    });
    const invalid = await runSeedCli({
      argv: ["--wat"],
      name: "bun run seed",
      steps: [],
    });

    assert.equal(help.exitCode, 0);
    assert.include(help.help ?? "", "--reset");
    assert.isFalse(didConnect);
    assert.equal(invalid.exitCode, 2);
  });
});
