import {afterEach, describe, it} from "bun:test";
import {act} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";
import {AdminProvider} from "../AdminProvider";
import {AdminVersionConfig} from "../AdminVersionConfig";
import {useCommsDashboardApi} from "../comms/useCommsDashboardApi";
import type {AdminApi} from "../types";
import {useAdminBackgroundTaskMutation} from "../useAdminBackgroundTask";
import {useAdminConfig} from "../useAdminConfig";
import {useAdminRoles} from "../useAdminRoles";
import {useAdminRpc, useAdminRpcMutation} from "../useAdminRpc";
import {useAdminScripts} from "../useAdminScripts";
import {useConfigurationApi} from "../useConfigurationApi";
import {useConsentHistory} from "../useConsentHistory";
import {useDocumentStorageApi} from "../useDocumentStorageApi";
import {AIRequestsScreenWidget} from "../widgets/AIRequestsScreenWidget";

const makeApi = (): AdminApi => {
  const api: Record<string, unknown> = {};
  const hooks = new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        if (prop.startsWith("use") && prop.endsWith("Mutation")) {
          return () => [() => ({unwrap: async () => ({})}), {isLoading: false}];
        }
        if (typeof prop === "string" && prop.startsWith("use")) {
          return () => ({
            data: undefined,
            error: null,
            isFetching: false,
            isLoading: false,
            refetch: () => undefined,
          });
        }
        return undefined;
      },
    }
  );
  api.enhanceEndpoints = () => api;
  api.injectEndpoints = () => hooks;
  return api as AdminApi;
};

const runHookWithRpc = <T,>(fn: () => T): T => {
  let captured: T | undefined;
  const Probe: React.FC = () => {
    captured = fn();
    return null;
  };
  const api = makeApi();
  renderWithTheme(
    <AdminProvider api={api} apiBase="/admin" credentials="same-origin" getAuthHeaders={() => ({})}>
      <Probe />
    </AdminProvider>
  );
  return captured as T;
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe("admin RPC dual-run", () => {
  const originalFetch = globalThis.fetch;
  const captured: {method?: string; url: string}[] = [];

  afterEach(() => {
    globalThis.fetch = originalFetch;
    captured.length = 0;
  });

  const mockOkFetch = (): void => {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      captured.push({method: init?.method, url: String(url)});
      return new Response(JSON.stringify({data: [], ok: true}), {
        headers: {"Content-Type": "application/json"},
        status: 200,
      });
    }) as typeof fetch;
  };

  it("useAdminConfig GETs /admin/config via fetch", async () => {
    mockOkFetch();
    runHookWithRpc(() => useAdminConfig(makeApi(), "/admin"));
    await flushEffects();
    assert.deepEqual(captured, [{method: "GET", url: "/admin/config"}]);
  });

  it("useAdminScripts run mutation POSTs the script run URL", async () => {
    mockOkFetch();
    const result = runHookWithRpc(() => {
      const {useRunScriptMutation} = useAdminScripts(makeApi(), "/admin");
      return useRunScriptMutation();
    });
    await result[0]({name: "migrate", wetRun: false}).unwrap();
    assert.deepEqual(captured, [{method: "POST", url: "/admin/scripts/migrate/run?wetRun=false"}]);
  });

  it("useAdminRoles lists roles at the rbac root", async () => {
    mockOkFetch();
    runHookWithRpc(() => {
      const {useListRolesQuery} = useAdminRoles(makeApi(), "/admin");
      return useListRolesQuery();
    });
    await flushEffects();
    assert.deepEqual(captured, [{method: "GET", url: "/rbac/roles"}]);
  });

  it("useConfigurationApi GETs configuration values", async () => {
    mockOkFetch();
    runHookWithRpc(() => {
      const {useValuesQuery} = useConfigurationApi({
        api: makeApi(),
        basePath: "/admin/configuration",
      });
      return useValuesQuery();
    });
    await flushEffects();
    assert.deepEqual(captured, [{method: "GET", url: "/admin/configuration"}]);
  });

  it("useDocumentStorageApi lists with a prefix query string", async () => {
    mockOkFetch();
    runHookWithRpc(() => {
      const {useListQuery} = useDocumentStorageApi(makeApi(), "/documents");
      return useListQuery("inbox");
    });
    await flushEffects();
    assert.deepEqual(captured, [{method: "GET", url: "/documents/?prefix=inbox"}]);
  });

  it("useAdminBackgroundTaskMutation POSTs /admin/background-tasks", async () => {
    mockOkFetch();
    const [enqueue] = runHookWithRpc(() => useAdminBackgroundTaskMutation(makeApi(), "/admin/"));
    await enqueue({kind: "bulk-patch"}).unwrap();
    assert.deepEqual(captured, [{method: "POST", url: "/admin/background-tasks"}]);
  });

  it("useConsentHistory GETs /consents/my", async () => {
    mockOkFetch();
    runHookWithRpc(() => useConsentHistory(makeApi() as never, "/admin"));
    await flushEffects();
    assert.deepEqual(captured, [{method: "GET", url: "/admin/consents/my"}]);
  });

  it("useCommsDashboardApi lists messages with query params", async () => {
    mockOkFetch();
    runHookWithRpc(() => {
      const {useListQuery} = useCommsDashboardApi(makeApi());
      return useListQuery({limit: 20, page: 1} as never);
    });
    await flushEffects();
    assert.include(captured[0]?.url ?? "", "/comms/messages");
    assert.strictEqual(captured[0]?.method, "GET");
  });

  it("document download uses parseAs blob", async () => {
    mockOkFetch();
    const result = runHookWithRpc(() => {
      const {useLazyDownloadQuery} = useDocumentStorageApi(makeApi(), "/documents");
      return useLazyDownloadQuery();
    });
    await result[0]("a.pdf").unwrap();
    assert.deepEqual(captured, [{method: "GET", url: "/documents/download/a.pdf"}]);
  });

  it("AI explorer GETs /aiRequestsExplorer", async () => {
    mockOkFetch();
    renderWithTheme(
      <AdminProvider
        api={makeApi()}
        apiBase="/admin"
        credentials="same-origin"
        getAuthHeaders={() => ({})}
      >
        <AIRequestsScreenWidget api={makeApi()} routeBase="/admin" />
      </AdminProvider>
    );
    await flushEffects();
    assert.ok(captured.some((row) => row.url.includes("/aiRequestsExplorer")));
    assert.strictEqual(
      captured.find((row) => row.url.includes("/aiRequestsExplorer"))?.method,
      "GET"
    );
  });

  it("version-config GETs /admin/version-config", async () => {
    mockOkFetch();
    renderWithTheme(
      <AdminProvider
        api={makeApi()}
        apiBase="/admin"
        credentials="same-origin"
        getAuthHeaders={() => ({})}
      >
        <AdminVersionConfig api={makeApi()} apiBase="/admin" />
      </AdminProvider>
    );
    await flushEffects();
    assert.deepEqual(
      captured.filter((row) => row.url.includes("version-config")),
      [{method: "GET", url: "/admin/version-config"}]
    );
  });

  it("consent form RPC mutations hit generate, publish, and translate", async () => {
    mockOkFetch();
    const trigger = runHookWithRpc(() => {
      const rpc = useAdminRpc();
      const [run] = useAdminRpcMutation(rpc);
      return run;
    });
    await trigger({
      body: {description: "d", locale: "en", type: "terms"},
      method: "POST",
      url: "/consent-forms/generate",
    }).unwrap();
    await trigger({method: "POST", url: "/consent-forms/form-id/publish"}).unwrap();
    await trigger({
      body: {content: "hi", fromLocale: "en", toLocale: "es"},
      method: "POST",
      url: "/consent-forms/translate",
    }).unwrap();
    assert.deepEqual(
      captured.map((row) => `${row.method} ${row.url}`),
      [
        "POST /consent-forms/generate",
        "POST /consent-forms/form-id/publish",
        "POST /consent-forms/translate",
      ]
    );
  });
});
