import {afterEach, describe, expect, it} from "bun:test";
import {FoodModel} from "@terreno/api/testing";

import type {AdminModelConfig} from "./adminApp";
import {convertLegacyModelConfig, resetLegacyDeprecationWarningsForTests} from "./legacy";

describe("convertLegacyModelConfig", () => {
  afterEach(() => {
    resetLegacyDeprecationWarningsForTests();
  });

  it("maps legacy fields onto AdminConfig and warns once per model", () => {
    const config: AdminModelConfig = {
      defaultSort: "-created",
      displayName: "Foods",
      hiddenFields: ["secret"],
      listFields: ["name", "calories"],
      model: FoodModel,
      permissions: {create: false, delete: true, update: true},
      routePath: "/foods",
    };

    const first = convertLegacyModelConfig(config);
    const second = convertLegacyModelConfig(config);

    expect(first.displayName).toBe("Foods");
    expect(first.admin.listFields).toEqual(["name", "calories"]);
    expect(first.admin.hiddenFields).toEqual(["secret"]);
    expect(first.permissions).toEqual({create: false, delete: true, update: true});
    expect(first.source).toBe("legacy");
    expect(second.source).toBe("legacy");
    expect(first.routePath).toBe("/foods");
  });
});
