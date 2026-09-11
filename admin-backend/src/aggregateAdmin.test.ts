import {describe, expect, it} from "bun:test";
import type {AdminConfig, AdminContribution, TerrenoPlugin} from "@terreno/api";
import {modelRouter, Permissions} from "@terreno/api";
import {FoodModel} from "@terreno/api/testing";
import {assert} from "chai";

import type {AdminModelConfig} from "./adminApp";
import {
  aggregateAdminContributions,
  aggregateFromTerrenoApp,
  collectRegisteredAdminModels,
} from "./aggregateAdmin";
import {resetLegacyDeprecationWarningsForTests} from "./legacy";
import {normalizeAdminRoutePath} from "./routePath";

const foodAdmin: AdminConfig = {
  displayName: "Foods",
  listFields: ["name"],
};

const legacyFood: AdminModelConfig = {
  displayName: "Legacy Foods",
  listFields: ["name"],
  model: FoodModel,
  routePath: "/foods",
};

describe("normalizeAdminRoutePath", () => {
  it("normalizes trailing slashes and missing leading slash", () => {
    expect(normalizeAdminRoutePath("users/")).toBe("/users");
    expect(normalizeAdminRoutePath("/users/")).toBe("/users");
    expect(normalizeAdminRoutePath("users")).toBe("/users");
  });
});

describe("aggregateAdminContributions", () => {
  it("merges legacy, plugin, and registered models with precedence", () => {
    resetLegacyDeprecationWarningsForTests();
    const pluginContribution: AdminContribution = {
      homeWidgets: [{displayName: "Overrides", id: "feature-flags-overrides"}],
      models: [
        {
          admin: {displayName: "Plugin Users", listFields: ["email"]},
          model: FoodModel,
          routePath: "/users",
        },
      ],
    };

    const registered = collectRegisteredAdminModels({
      getPlugins: () => [],
      getRegistrations: () => [
        modelRouter("/users", FoodModel, {
          admin: {displayName: "Registered Users", listFields: ["email"]},
          permissions: {
            create: [Permissions.IsAny],
            delete: [Permissions.IsAny],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsAny],
          },
        }),
      ],
    } as never);

    const aggregated = aggregateAdminContributions({
      legacyModels: [legacyFood],
      pluginContributions: [pluginContribution],
      registeredModels: registered,
    });

    expect(aggregated.models).toHaveLength(2);
    const users = aggregated.models.find((m) => m.routePath === "/users");
    expect(users?.source).toBe("registered");
    expect(users?.displayName).toBe("Registered Users");
    expect(aggregated.widgetIds).toEqual(["feature-flags-overrides"]);
  });

  it("forwards populatePaths from plugin model contributions", () => {
    const aggregated = aggregateAdminContributions({
      pluginContributions: [
        {
          models: [
            {
              admin: {displayName: "Foods", listFields: ["name"]},
              model: FoodModel,
              populatePaths: [{fields: ["email"], path: "ownerId"}],
              routePath: "/foods",
            },
          ],
        },
      ],
    });

    expect(aggregated.models[0]?.populatePaths).toEqual([{fields: ["email"], path: "ownerId"}]);
  });

  it("throws when two registered routers share a routePath", () => {
    const registered = collectRegisteredAdminModels({
      getPlugins: () => [],
      getRegistrations: () => [
        modelRouter("/dup", FoodModel, {
          admin: foodAdmin,
          permissions: {
            create: [Permissions.IsAny],
            delete: [Permissions.IsAny],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsAny],
          },
        }),
        modelRouter("/dup/", FoodModel, {
          admin: {...foodAdmin, displayName: "Dup 2"},
          permissions: {
            create: [Permissions.IsAny],
            delete: [Permissions.IsAny],
            list: [Permissions.IsAny],
            read: [Permissions.IsAny],
            update: [Permissions.IsAny],
          },
        }),
      ],
    } as never);

    expect(() =>
      aggregateAdminContributions({
        registeredModels: registered,
      })
    ).toThrow(/Duplicate admin modelRouter routePath/);
  });

  it("merges plugin scripts and custom screens, skipping duplicate names", () => {
    const pluginContribution: AdminContribution = {
      customScreens: [
        {displayName: "Flags", name: "feature-flags"},
        {displayName: "Flags again", name: "feature-flags"},
      ],
      scripts: [
        {
          description: "Seed foods",
          name: "seed-foods",
          runner: async () => ({results: [], success: true}),
        },
        {
          description: "Duplicate seed",
          name: "seed-foods",
          runner: async () => ({results: [], success: true}),
        },
      ],
    };

    const aggregated = aggregateAdminContributions({
      pluginContributions: [pluginContribution],
    });

    assert.deepEqual(
      aggregated.customScreens.map((screen) => screen.name),
      ["feature-flags"]
    );
    assert.equal(aggregated.customScreens[0]?.displayName, "Flags");
    assert.deepEqual(
      aggregated.scripts.map((script) => script.name),
      ["seed-foods"]
    );
    assert.equal(aggregated.scripts[0]?.description, "Seed foods");
  });

  it("skips duplicate home widget ids", () => {
    const aggregated = aggregateAdminContributions({
      pluginContributions: [
        {
          homeWidgets: [
            {displayName: "Overrides", id: "feature-flags-overrides"},
            {displayName: "Overrides again", id: "feature-flags-overrides"},
          ],
        },
      ],
    });

    assert.deepEqual(aggregated.widgetIds, ["feature-flags-overrides"]);
  });
});

describe("aggregateFromTerrenoApp", () => {
  it("collects plugin adminContribution models", () => {
    const plugin: TerrenoPlugin = {
      adminContribution: () => ({
        models: [
          {
            admin: {displayName: "Flags", listFields: ["key"]},
            model: FoodModel,
            routePath: "/feature-flags",
          },
        ],
      }),
      register() {},
    };

    const terrenoApp = {
      getPlugins: () => [plugin],
      getRegistrations: () => [],
    };

    const aggregated = aggregateFromTerrenoApp({terrenoApp: terrenoApp as never});
    expect(aggregated.models).toHaveLength(1);
    expect(aggregated.models[0]?.routePath).toBe("/feature-flags");
  });
});

const anyPermissions = {
  create: [Permissions.IsAny],
  delete: [Permissions.IsAny],
  list: [Permissions.IsAny],
  read: [Permissions.IsAny],
  update: [Permissions.IsAny],
};

describe("collectRegisteredAdminModels", () => {
  it("does not copy the public queryFilter onto admin CRUD", () => {
    const registered = collectRegisteredAdminModels({
      getPlugins: () => [],
      getRegistrations: () => [
        modelRouter("/foods", FoodModel, {
          admin: {displayName: "Foods", listFields: ["name"]},
          permissions: anyPermissions,
          queryFilter: () => ({ownerId: "public-owner"}),
        }),
      ],
    } as never);

    expect(registered).toHaveLength(1);
    expect(registered[0]?.queryFilter).toBeUndefined();
  });

  it("maps only explicitly set adminPermissions verbs", () => {
    const registered = collectRegisteredAdminModels({
      getPlugins: () => [],
      getRegistrations: () => [
        modelRouter("/foods", FoodModel, {
          admin: {
            adminPermissions: {delete: []},
            displayName: "Foods",
            listFields: ["name"],
          },
          permissions: anyPermissions,
        }),
      ],
    } as never);

    expect(registered[0]?.permissions).toEqual({delete: false});
  });

  it("uses adminFilter instead of the public queryFilter", async () => {
    const registered = collectRegisteredAdminModels({
      getPlugins: () => [],
      getRegistrations: () => [
        modelRouter("/foods", FoodModel, {
          admin: {
            adminFilter: () => ({$or: [{name: "A"}, {name: "B"}]}),
            displayName: "Foods",
            listFields: ["name"],
          },
          permissions: anyPermissions,
          queryFilter: () => ({ownerId: "public-owner"}),
        }),
      ],
    } as never);

    const scoped = await registered[0]?.queryFilter?.({} as never, {});
    expect(scoped).toEqual({$or: [{name: "A"}, {name: "B"}]});
  });
});
