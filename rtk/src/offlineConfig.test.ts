import {describe, expect, it} from "bun:test";

import {resolveOfflineEndpoints} from "./offlineConfig";

describe("offlineConfig", () => {
  it("resolves modelRouter config into endpoint entries", () => {
    const resolved = resolveOfflineEndpoints({
      enabled: true,
      models: [
        {
          endpoints: {
            create: {endpointName: "postTodos"},
            delete: {endpointName: "deleteTodosById"},
            update: {endpointName: "patchTodosById"},
          },
          modelName: "Todo",
          tagType: "todos",
        },
      ],
    });

    expect(resolved).toHaveLength(3);
    expect(resolved.map((entry) => entry.endpointName).sort()).toEqual([
      "deleteTodosById",
      "patchTodosById",
      "postTodos",
    ]);
  });

  it("returns empty list when modelRouter config is disabled", () => {
    const resolved = resolveOfflineEndpoints({
      enabled: false,
      models: [
        {
          endpoints: {create: {endpointName: "postTodos"}},
          modelName: "Todo",
          tagType: "todos",
        },
      ],
    });

    expect(resolved).toHaveLength(0);
  });

  it("supports legacy endpoint-name config", () => {
    const resolved = resolveOfflineEndpoints({
      endpoints: ["postTodos", "patchTodosById"],
    });

    expect(resolved).toHaveLength(2);
    expect(resolved[0].modelName).toBe("Todos");
  });
});
