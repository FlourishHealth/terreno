// noExplicitAny: test mocks use type-erased RTK Query API doubles
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import {useAdminScripts} from "../useAdminScripts";

interface BuildSpec {
  query?: (arg?: unknown) => unknown;
  providesTags?: unknown;
  invalidatesTags?: unknown;
}

interface CapturedEndpoints {
  [key: string]: BuildSpec;
}

const makeMockApi = () => {
  const injected: CapturedEndpoints = {};
  const fakeHooks: Record<string, unknown> = {};

  const addHookFor = (key: string, type: "query" | "mutation") => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const hookName = type === "query" ? `use${cap(key)}Query` : `use${cap(key)}Mutation`;
    fakeHooks[hookName] = mock(() =>
      type === "query"
        ? {data: undefined, error: null, isFetching: false, isLoading: false}
        : [mock(() => ({unwrap: async () => ({})})), {isLoading: false}]
    );
  };

  const base: Record<string, unknown> = {};
  Object.defineProperty(base, "__injected", {value: injected});

  const apiProxy: Record<string, unknown> = new Proxy(base, {
    get(target, prop: string) {
      if (prop === "injectEndpoints") {
        return ({endpoints}: {endpoints: (build: unknown) => Record<string, BuildSpec>}) => {
          const build = {
            mutation: (spec: BuildSpec) => ({...spec, __kind: "mutation"}),
            query: (spec: BuildSpec) => ({...spec, __kind: "query"}),
          };
          const defs = endpoints(build);
          for (const [key, def] of Object.entries(defs)) {
            injected[key] = def;
            const kind =
              (def as Record<string, unknown>).__kind === "mutation" ? "mutation" : "query";
            addHookFor(key, kind);
          }
          return apiProxy;
        };
      }
      if (prop in target) {
        return target[prop];
      }
      if (prop in fakeHooks) {
        return fakeHooks[prop];
      }
      return undefined;
    },
  });

  return apiProxy;
};

const runHook = <T,>(fn: () => T): T => {
  let result: T | undefined;
  const Probe: React.FC = () => {
    result = fn();
    return null;
  };
  renderWithTheme(<Probe />);
  return result as T;
};

describe("useAdminScripts", () => {
  it("injects list runs, run, get task, and cancel task endpoints", () => {
    const api = makeMockApi();
    const hooks = runHook(() => useAdminScripts(api as never, "/admin"));

    const injected = (api as Record<string, unknown>).__injected as CapturedEndpoints;
    assert.isDefined(injected.adminListScriptRuns);
    assert.isDefined(injected.adminRunScript);
    assert.isDefined(injected.adminGetScriptTask);
    assert.isDefined(injected.adminCancelScriptTask);

    const listDef = injected.adminListScriptRuns;
    const listQuery = listDef.query?.({limit: 10, name: "migrate", page: 2}) as {
      method: string;
      url: string;
    };
    assert.equal(listQuery.method, "GET");
    assert.equal(listQuery.url, "/admin/scripts/runs?page=2&limit=10&name=migrate");
    assert.deepEqual(listDef.providesTags, ["admin_scriptRuns"]);

    const runDef = injected.adminRunScript;
    assert.deepEqual(runDef.query?.({name: "cleanup", wetRun: true}), {
      method: "POST",
      url: "/admin/scripts/cleanup/run?wetRun=true",
    });
    assert.deepEqual(runDef.invalidatesTags, ["admin_scriptRuns"]);

    const getDef = injected.adminGetScriptTask;
    assert.deepEqual(getDef.query?.("task-42"), {
      method: "GET",
      url: "/admin/scripts/tasks/task-42",
    });
    assert.deepEqual(getDef.providesTags, ["admin_scriptTask"]);

    const cancelDef = injected.adminCancelScriptTask;
    assert.deepEqual(cancelDef.query?.("task-42"), {
      method: "DELETE",
      url: "/admin/scripts/tasks/task-42",
    });
    assert.deepEqual(cancelDef.invalidatesTags, ["admin_scriptTask", "admin_scriptRuns"]);

    expect(typeof hooks.useListScriptRunsQuery).toBe("function");
    expect(typeof hooks.useRunScriptMutation).toBe("function");
    expect(typeof hooks.useGetScriptTaskQuery).toBe("function");
    expect(typeof hooks.useCancelScriptTaskMutation).toBe("function");
  });

  it("returns no-op hooks when injectEndpoints is unavailable", () => {
    const hooks = runHook(() => useAdminScripts({} as never, "/admin"));

    const listResult = hooks.useListScriptRunsQuery();
    assert.deepEqual(listResult, {
      data: undefined,
      error: null,
      isFetching: false,
      isLoading: false,
    });

    const [runMutation] = hooks.useRunScriptMutation();
    assert.equal(typeof runMutation, "function");
    const runResult = runMutation({name: "noop", wetRun: false});
    assert.equal(typeof runResult.unwrap, "function");

    const [cancelMutation] = hooks.useCancelScriptTaskMutation();
    assert.equal(typeof cancelMutation, "function");
    const cancelResult = cancelMutation("task-1");
    assert.equal(typeof cancelResult.unwrap, "function");

    const taskQuery = hooks.useGetScriptTaskQuery("task-1", {pollingInterval: 0, skip: true});
    assert.deepEqual(taskQuery, {data: undefined, error: null, isLoading: false});

    const skippedList = hooks.useListScriptRunsQuery({page: 1}, {skip: true});
    assert.deepEqual(skippedList, {
      data: undefined,
      error: null,
      isFetching: false,
      isLoading: false,
    });
  });
});
