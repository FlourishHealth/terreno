import {describe, it} from "bun:test";
import {ConsentForm, runSeeds} from "@terreno/api";
import {assert} from "chai";
import {Project} from "../models/project";
import {Todo} from "../models/todo";
import {User} from "../models/user";
import {seedDefaultData, seedSteps} from "./seed-test-data";

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
  });

  it("previews todo creates on a first-time dry-run", async () => {
    await User.deleteMany({});

    const preview = await runSeeds({
      dryRun: true,
      name: "example-backend",
      steps: seedSteps,
    });

    assert.isAtLeast(preview.summary.created, 2);
    assert.equal(await User.countDocuments({}), 0);
  });
});
