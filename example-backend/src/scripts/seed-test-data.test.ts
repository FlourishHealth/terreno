import {describe, it} from "bun:test";
import {LocalEvaluatorStore, LocalPromptStore} from "@terreno/ai";
import {ConsentForm, runSeeds} from "@terreno/api";
import {CommsMessage} from "@terreno/comms";
import {assert} from "chai";
import {DateTime} from "luxon";
import {Project} from "../models/project";
import {Todo} from "../models/todo";
import {User} from "../models/user";
import {EXAMPLE_SUMMARIZE_PROMPT, seedDefaultData, seedSteps} from "./seed-test-data";

describe("seedDefaultData", () => {
  it("idempotently seeds the default users and example records", async () => {
    await seedDefaultData();
    await seedDefaultData();

    const admin = await User.findByEmail("admin@example.com");
    const superadmin = await User.findByEmail("superadmin@example.com");
    const user = await User.findByEmail("test@example.com");

    assert.exists(admin);
    assert.exists(superadmin);
    assert.exists(user);
    if (!admin || !superadmin || !user) {
      assert.fail("Default users were not seeded");
    }

    assert.isTrue(admin.admin);
    assert.isTrue(superadmin.admin);
    assert.include(superadmin.roles, "superadmin");
    assert.deepEqual(admin.organizationIds, ["org-example"]);
    assert.equal(
      await User.countDocuments({email: {$in: [admin.email, superadmin.email, user.email]}}),
      3
    );
    assert.equal(await Project.countDocuments({organizationId: "org-example"}), 2);
    assert.equal(await Todo.countDocuments({ownerId: user._id}), 2);
    assert.equal(await ConsentForm.countDocuments({}), 3);
    assert.equal(await CommsMessage.countDocuments({"metadata.demoSeed": true}), 10);
    const promptStore = new LocalPromptStore();
    const prompt = (await promptStore.list({search: "example-summarize"})).find(
      (entry) => entry.name === "example-summarize"
    );
    assert.equal(prompt?.folder, "examples");
    assert.equal(prompt?.latestVersion, 1);
    assert.equal(prompt?.production, 1);
    assert.equal(prompt?.type, "chat");
    const promptDetail = await promptStore.getDetail("example-summarize");
    assert.equal(promptDetail.versions[0]?.system, EXAMPLE_SUMMARIZE_PROMPT.system);
    assert.equal(promptDetail.versions[0]?.template, EXAMPLE_SUMMARIZE_PROMPT.template);
    assert.equal(promptDetail.versions[0]?.variables[0]?.key, "text");
    assert.include(promptDetail.tags, "example");
    const evaluator = (await new LocalEvaluatorStore().list()).find(
      (entry) => entry.name === "correctness"
    );
    assert.equal(evaluator?.type, "human");
    assert.equal(evaluator?.dimensions[0]?.key, "correct");
    assert.equal(evaluator?.dimensions[0]?.dataType, "boolean");
    assert.isTrue(evaluator?.dimensions[0]?.required);
    assert.equal(evaluator?.runModes.liveSampleRate, 0);
    assert.equal(
      await CommsMessage.countDocuments({
        "metadata.demoSeed": true,
        status: {$in: ["bounced", "failed"]},
      }),
      2
    );
    const oldestSeededMessages = await CommsMessage.find({"metadata.demoSeed": true})
      .sort({created: 1})
      .limit(1);
    const oldestSeededMessage = oldestSeededMessages[0];
    assert.exists(oldestSeededMessage);
    assert.isTrue(
      DateTime.fromJSDate(
        oldestSeededMessage?.created ?? DateTime.utc().minus({days: 2}).toJSDate()
      ).diffNow("days").days > -1
    );
  });

  it("previews todo creates on a first-time dry-run", async () => {
    await User.deleteMany({});

    const preview = await runSeeds({
      dryRun: true,
      name: "example-backend",
      steps: seedSteps,
    });

    assert.isAtLeast(preview.summary.created, 2);
    assert.includeMembers(
      preview.changes.map((change) => change.model),
      ["ObsPrompt", "ObsEvaluator"]
    );
    assert.equal(await User.countDocuments({}), 0);
  });
});
