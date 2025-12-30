import {beforeEach, describe, it} from "bun:test";
import {assert} from "chai";

import {unpopulate} from "./populate";
import {FoodModel, setupDb} from "./tests";

describe("populate functions", () => {
  let admin: any;
  let notAdmin: any;

  let spinach: any;

  beforeEach(async () => {
    [admin, notAdmin] = await setupDb();

    [spinach] = await Promise.all([
      FoodModel.create({
        calories: 1,
        created: new Date("2021-12-03T00:00:20.000Z"),
        eatenBy: [admin._id],
        hidden: false,
        likesIds: [
          {likes: true, userId: admin._id},
          {likes: false, userId: notAdmin._id},
        ],
        name: "Spinach",
        ownerId: admin._id,
        source: {
          name: "Brand",
        },
      }),
    ]);
  });

  it("unpopulate", async () => {
    let populated = await spinach.populate("ownerId");
    populated = await populated.populate("eatenBy");
    populated = await populated.populate("likesIds.userId");
    assert.equal(populated.ownerId.name, "Admin");
    assert.equal(populated.eatenBy[0].id, admin.id);
    assert.equal(populated.eatenBy[0].name, "Admin");
    assert.equal(populated.likesIds[0].userId.id, admin.id);
    assert.equal(populated.likesIds[0].userId.name, "Admin");
    assert.equal(populated.likesIds[1].userId.id, notAdmin.id);
    assert.equal(populated.likesIds[1].userId.name, "Not Admin");

    let unpopulated: any = unpopulate(populated, "ownerId");
    assert.isUndefined(spinach.ownerId.name);
    assert.equal(unpopulated.ownerId.toString(), admin.id);
    // Ensure nothing else was touched.
    assert.equal(populated.likesIds[0].userId.id, admin.id);
    assert.equal(populated.likesIds[0].userId.name, "Admin");
    assert.equal(populated.likesIds[1].userId.id, notAdmin.id);
    assert.equal(populated.likesIds[1].userId.name, "Not Admin");

    unpopulated = unpopulate(populated, "eatenBy");
    assert.equal(populated.eatenBy.toString(), admin.id);
    assert.isUndefined(populated.eatenBy[0]?.name);

    unpopulated = unpopulate(populated, "likesIds.userId");
    assert.equal(populated.likesIds[0].userId.toString(), admin.id);
    assert.isUndefined(populated.likesIds[0].userId?.name);
    assert.equal(populated.likesIds[1].userId.toString(), notAdmin.id);
    assert.isUndefined(populated.likesIds[1].userId.name);
  });
});
