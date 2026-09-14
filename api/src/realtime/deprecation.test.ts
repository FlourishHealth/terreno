import {afterEach, describe, expect, it, spyOn} from "bun:test";

import {modelRouter} from "../api";
import {logger} from "../logger";
import {Permissions} from "../permissions";
import {FoodModel} from "../tests";
import {
  REALTIME_DEPRECATION_MESSAGE,
  resetRealtimeDeprecationWarningsForTests,
} from "./deprecation";
import {clearRealtimeRegistry} from "./registry";

const realtimeConfig = {
  methods: ["create", "update", "delete"] as Array<"create" | "update" | "delete">,
  roomStrategy: "model" as const,
};

const permissions = {
  create: [Permissions.IsAny],
  delete: [Permissions.IsAny],
  list: [Permissions.IsAny],
  read: [Permissions.IsAny],
  update: [Permissions.IsAny],
};

describe("modelRouter realtime deprecation", () => {
  afterEach(() => {
    resetRealtimeDeprecationWarningsForTests();
    clearRealtimeRegistry();
  });

  it("warns once per model and path when realtime is configured", () => {
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => logger);

    modelRouter("/foods", FoodModel, {permissions, realtime: realtimeConfig});
    modelRouter("/foods", FoodModel, {permissions, realtime: realtimeConfig});

    const deprecationCalls = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes(REALTIME_DEPRECATION_MESSAGE)
    );
    expect(deprecationCalls).toHaveLength(1);
    expect(String(deprecationCalls[0]?.[0])).toContain("Food at /foods");

    warnSpy.mockRestore();
  });

  it("warns when realtime is used without the path form", () => {
    const warnSpy = spyOn(logger, "warn").mockImplementation(() => logger);

    modelRouter(FoodModel, {permissions, realtime: realtimeConfig});

    const deprecationCalls = warnSpy.mock.calls.filter((args) =>
      String(args[0]).includes(REALTIME_DEPRECATION_MESSAGE)
    );
    expect(deprecationCalls).toHaveLength(1);
    expect(String(deprecationCalls[0]?.[0])).toContain("(Food)");

    warnSpy.mockRestore();
  });
});
