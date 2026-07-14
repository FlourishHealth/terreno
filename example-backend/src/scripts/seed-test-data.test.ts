import {describe, it} from "bun:test";
import {ConsentForm} from "@terreno/api";
import {assert} from "chai";
import {Project} from "../models/project";
import {Todo} from "../models/todo";
import {User} from "../models/user";
import {seedDefaultData} from "./seed-test-data";

describe("seedDefaultData", () => {
  it("idempotently seeds the default users and example records", async () => {
    await seedDefaultData();
    await seedDefaultData();

    const admin = await User.findByEmail("superuser@example.com");
    const user = await User.findByEmail("test@example.com");

    assert.exists(admin);
    assert.exists(user);
    if (!admin || !user) {
      assert.fail("Default users were not seeded");
    }

    assert.isTrue(admin.admin);
    assert.deepEqual(admin.organizationIds, ["org-example"]);
    assert.equal(await User.countDocuments({email: {$in: [admin.email, user.email]}}), 2);
    assert.equal(await Project.countDocuments({organizationId: "org-example"}), 2);
    assert.equal(await Todo.countDocuments({ownerId: user._id}), 2);
    assert.equal(await ConsentForm.countDocuments({}), 3);
  });
});
