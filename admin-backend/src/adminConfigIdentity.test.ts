import {describe, expect, it} from "bun:test";

import {
  assignUniqueAdminConfigNames,
  findAdminModelMetaByRoutePath,
  slugFromAdminRoutePath,
} from "./adminConfigIdentity";

describe("slugFromAdminRoutePath", () => {
  it("strips slashes and joins nested segments", () => {
    expect(slugFromAdminRoutePath("/foods")).toBe("foods");
    expect(slugFromAdminRoutePath("/nested/foods/")).toBe("nested-foods");
    expect(slugFromAdminRoutePath("")).toBe("model");
  });
});

describe("assignUniqueAdminConfigNames", () => {
  it("keeps the Mongoose model name when it is unique", () => {
    expect(
      assignUniqueAdminConfigNames([
        {modelName: "Food", routePath: "/foods"},
        {modelName: "User", routePath: "/users"},
      ])
    ).toEqual(["Food", "User"]);
  });

  it("keeps the registered entry unsuffixed when the same model is mounted twice", () => {
    expect(
      assignUniqueAdminConfigNames([
        {modelName: "Food", routePath: "/feature-flags", source: "plugin"},
        {modelName: "Food", routePath: "/foods", source: "registered"},
      ])
    ).toEqual(["Food-feature-flags", "Food"]);
  });

  it("suffixes later duplicates of the same source", () => {
    expect(
      assignUniqueAdminConfigNames([
        {modelName: "Food", routePath: "/foods", source: "registered"},
        {modelName: "Food", routePath: "/archived-foods", source: "registered"},
      ])
    ).toEqual(["Food", "Food-archived-foods"]);
  });
});

describe("findAdminModelMetaByRoutePath", () => {
  it("matches the mounted API path rather than the first same-named model", () => {
    const models = [
      {name: "Food", routePath: "/admin/foods", searchFields: ["name"]},
      {name: "Food-archived-foods", routePath: "/admin/archived-foods", searchFields: ["calories"]},
    ];
    expect(findAdminModelMetaByRoutePath(models, "/admin/archived-foods")?.searchFields).toEqual([
      "calories",
    ]);
  });
});
