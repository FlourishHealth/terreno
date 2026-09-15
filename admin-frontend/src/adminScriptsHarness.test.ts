import {describe, expect, it} from "bun:test";
import type {BackgroundTask} from "./types";

/**
 * Shared bun-test double for `useAdminScripts`. `mock.module` is process-wide,
 * so AdminScriptList and AdminMigrationsView tests must read the same task query
 * state instead of installing competing module mocks.
 */
export const adminScriptsHarness: {
  taskQuery: {data: {task?: BackgroundTask} | undefined; error: unknown};
} = {
  taskQuery: {data: undefined, error: null},
};

describe("adminScriptsHarness", () => {
  it("starts with an empty task query", (): void => {
    expect(adminScriptsHarness.taskQuery.data).toBeUndefined();
  });
});
