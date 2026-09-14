import type {BackgroundTask} from "./types";

/**
 * Shared bun-test double for `useAdminScripts`. `mock.module` is process-wide,
 * so AdminScriptList and AdminMigrationsView tests must read the same task query
 * state instead of installing competing module mocks.
 */
export const adminScriptsHarness: {
  taskQuery: {data: {task?: BackgroundTask} | undefined};
} = {
  taskQuery: {data: undefined},
};
