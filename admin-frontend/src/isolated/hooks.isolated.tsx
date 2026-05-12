/**
 * Tests for admin-frontend hooks: useAdminApi, useAdminConfig,
 * useAdminScripts, useConfigurationApi, useDocumentStorageApi.
 *
 * These hooks all inject RTK Query endpoints into a provided Api instance,
 * and expose generated RTK hooks by name. We assert:
 *  - the right endpoint keys are injected with expected method/url shapes
 *  - the returned hook functions correspond to the generated hook names
 */
import {describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {useAdminApi} from "../useAdminApi";
import {useAdminConfig} from "../useAdminConfig";
import {useAdminScripts} from "../useAdminScripts";
import {useConfigurationApi} from "../useConfigurationApi";
import {useDocumentStorageApi} from "../useDocumentStorageApi";

interface BuildSpec {
  query?: (arg?: unknown) => unknown;
  mutation?: (arg?: unknown) => unknown;
  providesTags?: unknown;
  invalidatesTags?: unknown;
  extraOptions?: unknown;
}

interface CapturedEndpoints {
  [key: string]: BuildSpec;
}

const makeMockApi = () => {
  const injected: CapturedEndpoints = {};
  const enhancedTagTypes: string[] = [];

  const fakeHooks: Record<string, any> = {};

  const addHookFor = (key: string, type: "query" | "mutation") => {
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const hookName = type === "query" ? `use${cap(key)}Query` : `use${cap(key)}Mutation`;
    const lazyHookName = `useLazy${cap(key)}Query`;
    fakeHooks[hookName] = mock(() =>
      type === "query"
        ? {data: undefined, error: null, isLoading: false}
        : [mock(() => ({unwrap: async () => ({})})), {isLoading: false}]
    );
    if (type === "query") {
      fakeHooks[lazyHookName] = mock(() => [
        mock(() => ({unwrap: async () => ({})})),
        {data: undefined, isLoading: false},
      ]);
    }
  };

  const base: any = {};
  Object.defineProperty(base, "__fakeHooks", {value: fakeHooks});
  Object.defineProperty(base, "__injected", {value: injected});
  Object.defineProperty(base, "__tagTypes", {value: enhancedTagTypes});

  const apiProxy: any = new Proxy(base, {
    get(target, prop: string) {
      if (prop === "enhanceEndpoints") {
        return ({addTagTypes}: {addTagTypes: string[]}) => {
          enhancedTagTypes.push(...addTagTypes);
          return apiProxy;
        };
      }
      if (prop === "injectEndpoints") {
        return ({endpoints}: {endpoints: (build: any) => Record<string, BuildSpec>}) => {
          const build = {
            mutation: (spec: BuildSpec) => ({...spec, __kind: "mutation"}),
            query: (spec: BuildSpec) => ({...spec, __kind: "query"}),
          };
          const defs = endpoints(build);
          for (const [key, def] of Object.entries(defs)) {
            injected[key] = def;
            const kind = (def as any).__kind === "mutation" ? "mutation" : "query";
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
  let captured: T | undefined;
  const Probe = () => {
    captured = fn();
    return null;
  };
  renderWithTheme(<Probe />);
  return captured as T;
};

describe("useAdminApi", () => {
  it("injects list/read/create/update/delete endpoints with admin tag", () => {
    const api = makeMockApi();
    const result = runHook(() => useAdminApi(api, "/admin/users", "User"));

    const injected = (api as any).__injected as CapturedEndpoints;
    expect(injected.adminList_User).toBeDefined();
    expect(injected.adminRead_User).toBeDefined();
    expect(injected.adminCreate_User).toBeDefined();
    expect(injected.adminUpdate_User).toBeDefined();
    expect(injected.adminDelete_User).toBeDefined();

    // tag types include the admin_<model>
    expect((api as any).__tagTypes).toContain("admin_User");

    // Each endpoint's query fn produces expected URL/method
    const listDef: any = injected.adminList_User;
    expect(listDef.query({limit: 1})).toEqual({
      method: "GET",
      params: {limit: 1},
      url: "/admin/users",
    });
    expect(listDef.query(undefined)).toEqual({
      method: "GET",
      params: {},
      url: "/admin/users",
    });

    const readDef: any = injected.adminRead_User;
    expect(readDef.query("abc")).toEqual({
      method: "GET",
      url: "/admin/users/abc",
    });
    expect(readDef.providesTags(null, null, "abc")).toEqual([{id: "abc", type: "admin_User"}]);

    const createDef: any = injected.adminCreate_User;
    expect(createDef.query({name: "x"})).toEqual({
      body: {name: "x"},
      method: "POST",
      url: "/admin/users",
    });
    expect(createDef.invalidatesTags).toEqual(["admin_User"]);

    const updateDef: any = injected.adminUpdate_User;
    expect(updateDef.query({body: {x: 1}, id: "123"})).toEqual({
      body: {x: 1},
      method: "PATCH",
      url: "/admin/users/123",
    });
    expect(updateDef.invalidatesTags(null, null, {id: "123"})).toEqual([
      {id: "123", type: "admin_User"},
      "admin_User",
    ]);

    const deleteDef: any = injected.adminDelete_User;
    expect(deleteDef.query("123")).toEqual({
      method: "DELETE",
      url: "/admin/users/123",
    });

    // Returned hooks should be functions (generated by our mock)
    expect(typeof result.useListQuery).toBe("function");
    expect(typeof result.useReadQuery).toBe("function");
    expect(typeof result.useCreateMutation).toBe("function");
    expect(typeof result.useUpdateMutation).toBe("function");
    expect(typeof result.useDeleteMutation).toBe("function");
  });
});

describe("useAdminConfig", () => {
  it("injects adminConfig query and exposes config hook data", () => {
    const api = makeMockApi();
    const result = runHook(() => useAdminConfig(api, "/admin"));

    const injected = (api as any).__injected as CapturedEndpoints;
    expect(injected.adminConfig).toBeDefined();
    const def: any = injected.adminConfig;
    expect(def.query()).toEqual({method: "GET", url: "/admin/config"});

    expect(result).toMatchObject({
      config: undefined,
      error: null,
      isLoading: false,
    });
  });
});

describe("useAdminScripts", () => {
  it("injects run/get/cancel task endpoints", () => {
    const api = makeMockApi();
    const result = runHook(() => useAdminScripts(api, "/admin"));

    const injected = (api as any).__injected as CapturedEndpoints;
    expect(injected.adminRunScript).toBeDefined();
    expect(injected.adminGetScriptTask).toBeDefined();
    expect(injected.adminCancelScriptTask).toBeDefined();

    const runDef: any = injected.adminRunScript;
    expect(runDef.query({name: "migrate", wetRun: false})).toEqual({
      method: "POST",
      url: "/admin/scripts/migrate/run?wetRun=false",
    });

    const getDef: any = injected.adminGetScriptTask;
    expect(getDef.query("task-1")).toEqual({
      method: "GET",
      url: "/admin/scripts/tasks/task-1",
    });
    expect(getDef.providesTags).toEqual(["admin_scriptTask"]);

    const cancelDef: any = injected.adminCancelScriptTask;
    expect(cancelDef.query("task-1")).toEqual({
      method: "DELETE",
      url: "/admin/scripts/tasks/task-1",
    });
    expect(cancelDef.invalidatesTags).toEqual(["admin_scriptTask"]);

    expect(typeof result.useRunScriptMutation).toBe("function");
    expect(typeof result.useGetScriptTaskQuery).toBe("function");
    expect(typeof result.useCancelScriptTaskMutation).toBe("function");
  });
});

describe("useConfigurationApi", () => {
  it("injects meta/values/update/refresh-secrets endpoints", () => {
    const api = makeMockApi();
    const result = runHook(() => useConfigurationApi({api, basePath: "/admin/configuration"}));

    const injected = (api as any).__injected as CapturedEndpoints;
    expect(injected.configMeta).toBeDefined();
    expect(injected.configValues).toBeDefined();
    expect(injected.configUpdate).toBeDefined();
    expect(injected.configRefreshSecrets).toBeDefined();
    expect((api as any).__tagTypes).toContain("configuration");

    expect((injected.configMeta as any).query()).toEqual({
      method: "GET",
      url: "/admin/configuration/meta",
    });
    expect((injected.configValues as any).query()).toEqual({
      method: "GET",
      url: "/admin/configuration",
    });
    expect((injected.configValues as any).providesTags).toEqual(["configuration"]);
    expect((injected.configUpdate as any).query({a: 1})).toEqual({
      body: {a: 1},
      method: "PATCH",
      url: "/admin/configuration",
    });
    expect((injected.configUpdate as any).invalidatesTags).toEqual(["configuration"]);
    expect((injected.configRefreshSecrets as any).query()).toEqual({
      method: "POST",
      url: "/admin/configuration/refresh-secrets",
    });

    expect(typeof result.useMetaQuery).toBe("function");
    expect(typeof result.useValuesQuery).toBe("function");
    expect(typeof result.useUpdateMutation).toBe("function");
    expect(typeof result.useRefreshSecretsMutation).toBe("function");
  });
});

describe("useDocumentStorageApi", () => {
  it("injects list/upload/download/delete/folder endpoints", () => {
    const api = makeMockApi();
    const result = runHook(() => useDocumentStorageApi(api, "/documents"));

    const injected = (api as any).__injected as CapturedEndpoints;
    expect(injected.documentStorageList).toBeDefined();
    expect(injected.documentStorageUpload).toBeDefined();
    expect(injected.documentStorageDownload).toBeDefined();
    expect(injected.documentStorageDelete).toBeDefined();
    expect(injected.documentStorageDeleteFolder).toBeDefined();
    expect(injected.documentStorageCreateFolder).toBeDefined();

    const listDef: any = injected.documentStorageList;
    expect(listDef.query()).toEqual({
      method: "GET",
      params: {},
      url: "/documents/",
    });
    expect(listDef.query("my/folder")).toEqual({
      method: "GET",
      params: {prefix: "my/folder"},
      url: "/documents/",
    });
    expect(listDef.providesTags).toEqual(["documentStorage"]);

    // Upload appends prefix to formData when provided
    const uploadDef: any = injected.documentStorageUpload;
    const fd: {append: (k: string, v: string) => void; entries: string[]} = {
      append(k: string, v: string) {
        this.entries.push(`${k}=${v}`);
      },
      entries: [],
    };
    const uploadWithPrefix = uploadDef.query({
      formData: fd as unknown as FormData,
      prefix: "sub/",
    });
    expect(uploadWithPrefix).toMatchObject({
      method: "POST",
      url: "/documents/",
    });
    expect(fd.entries).toContain("prefix=sub/");

    const fd2: {append: (k: string, v: string) => void; entries: string[]} = {
      append(k: string, v: string) {
        this.entries.push(`${k}=${v}`);
      },
      entries: [],
    };
    uploadDef.query({formData: fd2 as unknown as FormData});
    expect(fd2.entries.length).toBe(0);

    // Download returns a URL with encoded path and a responseHandler
    const downloadDef: any = injected.documentStorageDownload;
    const dlSpec = downloadDef.query("my folder/file.pdf");
    expect(dlSpec.url).toBe("/documents/download/my%20folder%2Ffile.pdf");
    expect(dlSpec.method).toBe("GET");
    expect(typeof dlSpec.responseHandler).toBe("function");

    // responseHandler returns the blob on ok
    const okBlob = {size: 5, type: "text/plain"};
    const okResp = {
      blob: async () => okBlob,
      headers: {get: () => "text/plain"},
      ok: true,
      status: 200,
      statusText: "OK",
    };
    return dlSpec.responseHandler(okResp).then(async (blob: unknown) => {
      expect(blob).toBe(okBlob);

      // non-ok JSON response
      const errJson = '{"detail":"Bad","status":400}';
      const jsonResp = {
        headers: {get: () => "application/json"},
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => errJson,
      };
      const parsed = await dlSpec.responseHandler(jsonResp);
      expect(parsed).toEqual({detail: "Bad", status: 400});

      // non-ok non-JSON response (fallback)
      const textResp = {
        headers: {get: () => "text/plain"},
        ok: false,
        status: 500,
        statusText: "err",
        text: async () => "boom",
      };
      const textParsed = await dlSpec.responseHandler(textResp);
      expect(textParsed).toEqual({detail: "boom", status: 500});

      // Delete endpoints
      const deleteDef: any = injected.documentStorageDelete;
      expect(deleteDef.query("a b.pdf")).toEqual({
        method: "DELETE",
        url: "/documents/a%20b.pdf",
      });
      const deleteFolderDef: any = injected.documentStorageDeleteFolder;
      expect(deleteFolderDef.query("subdir/")).toEqual({
        method: "DELETE",
        url: "/documents/folder/subdir%2F",
      });

      const createDef: any = injected.documentStorageCreateFolder;
      expect(createDef.query({folderName: "new", prefix: "a/"})).toEqual({
        body: {folderName: "new", prefix: "a/"},
        method: "POST",
        url: "/documents/folder",
      });

      // Hooks exposed
      expect(typeof result.useListQuery).toBe("function");
      expect(typeof result.useUploadMutation).toBe("function");
      expect(typeof result.useLazyDownloadQuery).toBe("function");
      expect(typeof result.useDeleteMutation).toBe("function");
      expect(typeof result.useDeleteFolderMutation).toBe("function");
      expect(typeof result.useCreateFolderMutation).toBe("function");
    });
  });
});
