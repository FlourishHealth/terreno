import {beforeEach, describe, expect, it} from "bun:test";

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
    expect(populated.ownerId.name).toBe("Admin");
    expect(populated.eatenBy[0].id).toBe(admin.id);
    expect(populated.eatenBy[0].name).toBe("Admin");
    expect(populated.likesIds[0].userId.id).toBe(admin.id);
    expect(populated.likesIds[0].userId.name).toBe("Admin");
    expect(populated.likesIds[1].userId.id).toBe(notAdmin.id);
    expect(populated.likesIds[1].userId.name).toBe("Not Admin");

    let unpopulated: any = unpopulate(populated, "ownerId");
    expect(spinach.ownerId.name).toBeUndefined();
    expect(unpopulated.ownerId.toString()).toBe(admin.id);
    // Ensure nothing else was touched.
    expect(populated.likesIds[0].userId.id).toBe(admin.id);
    expect(populated.likesIds[0].userId.name).toBe("Admin");
    expect(populated.likesIds[1].userId.id).toBe(notAdmin.id);
    expect(populated.likesIds[1].userId.name).toBe("Not Admin");

    unpopulated = unpopulate(populated, "eatenBy");
    expect(populated.eatenBy.toString()).toBe(admin.id);
    expect(populated.eatenBy[0]?.name).toBeUndefined();

    unpopulated = unpopulate(populated, "likesIds.userId");
    expect(populated.likesIds[0].userId.toString()).toBe(admin.id);
    expect(populated.likesIds[0].userId?.name).toBeUndefined();
    expect(populated.likesIds[1].userId.toString()).toBe(notAdmin.id);
    expect(populated.likesIds[1].userId.name).toBeUndefined();
  });
});
