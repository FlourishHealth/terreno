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

describe("unpopulate edge cases", () => {
  it("throws error when path is empty", () => {
    const doc = {name: "test"};
    expect(() => unpopulate(doc as any, "")).toThrow("path is required");
  });

  it("unpopulates single populated field", () => {
    const doc = {
      name: "test",
      ownerId: {_id: "owner-123", email: "owner@test.com"},
    };
    const result = unpopulate(doc as any, "ownerId") as any;
    expect(result.ownerId).toBe("owner-123");
  });

  it("unpopulates array of populated fields", () => {
    const doc = {
      items: [{_id: "item-1", name: "Item 1"}, {_id: "item-2", name: "Item 2"}, "item-3"],
      name: "test",
    };
    const result = unpopulate(doc as any, "items") as any;
    expect(result.items).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("handles nested paths", () => {
    const doc = {
      name: "test",
      nested: {
        items: [
          {_id: "item-1", name: "Item 1"},
          {_id: "item-2", name: "Item 2"},
        ],
      },
    };
    const result = unpopulate(doc as any, "nested.items") as any;
    expect(result.nested.items).toEqual(["item-1", "item-2"]);
  });

  it("returns original doc when path does not exist", () => {
    const doc = {name: "test"};
    const result = unpopulate(doc as any, "nonexistent") as any;
    expect(result).toEqual(doc);
  });

  it("handles nested array paths", () => {
    const doc = {
      containers: [
        {items: [{_id: "item-1"}, {_id: "item-2"}]},
        {items: [{_id: "item-3"}, {_id: "item-4"}]},
      ],
      name: "test",
    };
    const result = unpopulate(doc as any, "containers.items") as any;
    expect(result.containers[0].items).toEqual(["item-1", "item-2"]);
    expect(result.containers[1].items).toEqual(["item-3", "item-4"]);
  });
});
