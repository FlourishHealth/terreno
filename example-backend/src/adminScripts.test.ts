import {describe, it} from "bun:test";
import {ConsentForm} from "@terreno/api";
import {FeatureFlag} from "@terreno/feature-flags";
import {assert} from "chai";

import {adminScripts, isDatabaseResetAllowed, resetExampleDatabase} from "./adminScripts";
import {Project} from "./models/project";
import {Todo} from "./models/todo";
import {User} from "./models/user";
import {seedDefaultData} from "./scripts/seed-test-data";

describe("resetDatabase admin script", () => {
  it("requires an explicit override for live production resets", () => {
    assert.isFalse(
      isDatabaseResetAllowed({isExplicitlyAllowed: false, isProduction: true})
    );
    assert.isTrue(isDatabaseResetAllowed({isExplicitlyAllowed: true, isProduction: true}));
    assert.isTrue(isDatabaseResetAllowed({isExplicitlyAllowed: false, isProduction: false}));
  });

  it("is registered for the admin script runner", () => {
    const script = adminScripts.find(({name}) => name === "resetDatabase");

    assert.exists(script);
    assert.match(script?.description ?? "", /restore defaults/i);
  });

  it("reports affected records without changing data during a dry run", async () => {
    await seedDefaultData();
    const before = await Todo.countDocuments();

    const result = await resetExampleDatabase(false);

    assert.isTrue(result.success);
    assert.match(result.results[0], /Dry run: would reset/);
    assert.equal(await Todo.countDocuments(), before);
  });

  it("clears example data, restores defaults, and preserves the superuser", async () => {
    await seedDefaultData();
    const user = await User.findByEmail("test@example.com");
    assert.exists(user);
    if (!user) {
      assert.fail("Seeded test user is required");
    }
    await Todo.create({ownerId: user._id, title: "Temporary reset record"});
    await Project.create({organizationId: "org-example", title: "Temporary reset project"});

    const result = await resetExampleDatabase(true);

    assert.isTrue(result.success);
    assert.equal(await Todo.countDocuments({deleted: {$ne: true}, ownerId: user._id}), 2);
    assert.equal(
      await Project.countDocuments({deleted: {$ne: true}, organizationId: "org-example"}),
      2
    );
    assert.equal(await ConsentForm.countDocuments(), 3);
    assert.equal(await FeatureFlag.countDocuments(), 5);
    const superuser = await User.findByEmail("superuser@example.com");
    assert.exists(superuser);
    assert.isTrue(superuser?.admin);
    assert.include(superuser?.roles ?? [], "superadmin");
  });
});
