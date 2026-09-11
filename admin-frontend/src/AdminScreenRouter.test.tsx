// noExplicitAny: test harness doubles for AdminScreenRouter routing and config mocks
// biome-ignore-all lint/suspicious/noExplicitAny: test harness doubles
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse, BackgroundTask} from "./types";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
  useNavigation: () => ({setOptions: mock(() => {})}),
}));

const configState: {config: AdminConfigResponse | null; isLoading: boolean} = {
  config: null,
  isLoading: false,
};

mock.module("./useAdminConfig", () => ({
  useAdminConfig: () => ({
    config: configState.config,
    error: null,
    isLoading: configState.isLoading,
  }),
}));

mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useBulkPatchMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useCreateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useDeleteMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useListQuery: () => ({
      data: {data: [], total: 0},
      error: null,
      isError: false,
      isLoading: false,
      refetch: mock(() => {}),
    }),
    useReadQuery: () => ({data: undefined, isLoading: false}),
    useUpdateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
  }),
}));

mock.module("./useAdminBackgroundTask", () => ({
  useAdminBackgroundTaskMutation: () => [mock(() => ({unwrap: async () => ({taskId: "t1"})}))],
}));

import {AdminMigrationsView} from "./AdminMigrationsView";
import {AdminScreenRouter} from "./AdminScreenRouter";

const injectAdminEndpoints = ({
  endpoints,
}: {
  endpoints: (builder: unknown) => Record<string, unknown>;
}): Record<string, unknown> => {
  endpoints({
    mutation: (spec: Record<string, unknown>) => spec,
    query: (spec: Record<string, unknown>) => spec,
  });
  return {
    useAdminVersionConfigQuery: () => ({data: null, error: null, isLoading: false}),
    useUpdateVersionConfigMutation: () => [() => ({unwrap: async () => ({})}), {isLoading: false}],
  };
};

const adminApi = {
  enhanceEndpoints: () => ({injectEndpoints: injectAdminEndpoints}),
  injectEndpoints: injectAdminEndpoints,
} as unknown as AdminApi;

const baseConfig: AdminConfigResponse = {
  customScreens: [{displayName: "AI Admin", name: "ai-admin"}],
  models: [
    {
      defaultSort: "-created",
      displayName: "Foods",
      fields: {name: {required: true, type: "string"}},
      listFields: ["name"],
      name: "Food",
      routePath: "/admin/foods",
    },
  ],
  scripts: [{description: "Test", name: "test-script"}],
};

describe("AdminScreenRouter", () => {
  beforeEach(() => {
    configState.config = baseConfig;
    configState.isLoading = false;
  });

  it("renders AdminMigrations for __migrations", () => {
    const {getByTestId} = renderWithTheme(
      <AdminScreenRouter api={adminApi} baseUrl="/admin" name="__migrations" />
    );
    expect(getByTestId("admin-migrations")).toBeTruthy();
  });

  it("renders AdminModelTable for a configured model name", () => {
    const {getByTestId} = renderWithTheme(
      <AdminScreenRouter api={adminApi} baseUrl="/admin" name="Food" />
    );
    expect(getByTestId("admin-list-Food")).toBeTruthy();
  });

  it("renders built-in version-config screen widget", () => {
    const {getByText} = renderWithTheme(
      <AdminScreenRouter api={adminApi} baseUrl="/admin" name="version-config" />
    );
    expect(getByText("Version Config")).toBeTruthy();
  });

  it("shows missing widget placeholder for unregistered custom screens", () => {
    const {getByTestId} = renderWithTheme(
      <AdminScreenRouter api={adminApi} baseUrl="/admin" name="ai-admin" />
    );
    expect(getByTestId("admin-missing-widget-ai-admin")).toBeTruthy();
  });

  it("returns not-found for unknown routes", () => {
    const {getByTestId} = renderWithTheme(
      <AdminScreenRouter api={adminApi} baseUrl="/admin" name="unknown-route" />
    );
    expect(getByTestId("admin-screen-not-found")).toBeTruthy();
  });
});

const mockRun = mock((_args: {wetRun: boolean}) => ({
  unwrap: async () => ({taskId: "task-1"}),
}));

const mockRefetch = mock(() => {});

interface MigrationQueryState {
  data:
    | {
        applied: Array<{appliedAt?: string; checksum: string; id: string}>;
        lock: {expiresAt: string; holder: string} | null;
        pending: Array<{checksum: string; id: string}>;
      }
    | undefined;
  error: Error | null;
  isLoading: boolean;
  refetch: typeof mockRefetch;
}

const queryState: MigrationQueryState = {
  data: {
    applied: [],
    lock: null,
    pending: [{checksum: "abc", id: "20260910120000-todos-title-owner-index"}],
  },
  error: null,
  isLoading: false,
  refetch: mockRefetch,
};

const mockTask: {data: {task?: BackgroundTask} | undefined} = {data: undefined};

const createApiDouble = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useAdminGetMigrationsQuery: () => queryState,
      useAdminGetScriptTaskQuery: () => mockTask,
      useAdminRunMigrationsMutation: () => [mockRun, {isLoading: false}],
    }),
  };
  return api as unknown as AdminApi;
};

const enabledConfig = {
  migrations: {enabled: true},
  models: [],
  scripts: [],
} as AdminConfigResponse;

const renderView = (
  overrides: Partial<{
    config: AdminConfigResponse | null;
    configError: unknown;
    isConfigLoading: boolean;
  }> = {}
): ReturnType<typeof renderWithTheme> => {
  return renderWithTheme(
    <AdminMigrationsView
      api={createApiDouble()}
      apiBase="/admin"
      config={overrides.config === undefined ? enabledConfig : overrides.config}
      configError={overrides.configError}
      isConfigLoading={overrides.isConfigLoading ?? false}
    />
  );
};

const resetQueryState = (): void => {
  queryState.data = {
    applied: [],
    lock: null,
    pending: [{checksum: "abc", id: "20260910120000-todos-title-owner-index"}],
  };
  queryState.error = null;
  queryState.isLoading = false;
  queryState.refetch = mockRefetch;
};

describe("AdminMigrationsView", () => {
  beforeEach(() => {
    mockRun.mockClear();
    mockRefetch.mockClear();
    mockTask.data = undefined;
    resetQueryState();
  });

  it("renders a spinner while admin config loads", () => {
    const {getByTestId} = renderView({config: null, isConfigLoading: true});
    expect(getByTestId("admin-migrations-loading")).toBeTruthy();
  });

  it("renders a config error", () => {
    const {getByTestId} = renderView({config: null, configError: new Error("network")});
    expect(getByTestId("admin-migrations-config-error")).toBeTruthy();
  });

  it("renders a disabled message when migrations are not configured", () => {
    const {getByText} = renderView({
      config: {migrations: {enabled: false}, models: [], scripts: []},
    });
    expect(getByText("Migrations are not configured on this server.")).toBeTruthy();
  });

  it("lists pending files and starts a dry-run", async () => {
    const {getByTestId, getByText} = renderView();

    expect(getByTestId("admin-migrations")).toBeTruthy();
    expect(getByText("20260910120000-todos-title-owner-index")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(mockRun).toHaveBeenCalledWith({wetRun: false});
  });

  it("starts a wet apply", async () => {
    const {getByText} = renderView();
    await act(async () => {
      fireEvent.press(getByText("Apply pending"));
    });
    expect(mockRun).toHaveBeenCalledWith({wetRun: true});
  });

  it("disables dry-run and apply when runScripts is false", () => {
    const {getByTestId} = renderView({
      config: {
        migrations: {enabled: true},
        models: [],
        platformTools: {runScripts: false},
        scripts: [],
      } as AdminConfigResponse,
    });
    expect(getByTestId("admin-migrations-dry-run").props.accessibilityState.disabled).toBe(true);
    expect(getByTestId("admin-migrations-apply").props.accessibilityState.disabled).toBe(true);
  });

  it("renders a status error", () => {
    queryState.data = undefined;
    queryState.error = new Error("status failed");
    const {getByText} = renderView();
    expect(getByText("Failed to load migration status.")).toBeTruthy();
  });

  it("renders a spinner while migration status loads", () => {
    queryState.data = undefined;
    queryState.isLoading = true;
    const {getByTestId, queryByTestId} = renderView();
    expect(getByTestId("admin-migrations")).toBeTruthy();
    expect(queryByTestId("admin-migrations-pending")).toBeNull();
  });

  it("renders lock and applied rows", () => {
    queryState.data = {
      applied: [
        {
          appliedAt: "2026-09-10T12:00:00.000Z",
          checksum: "def",
          id: "20260910110000-todos-title-index",
        },
      ],
      lock: {expiresAt: "2026-09-10T13:00:00.000Z", holder: "api-1"},
      pending: [],
    };
    const {getByText} = renderView();
    expect(getByText("Lock held by api-1")).toBeTruthy();
    expect(getByText(/20260910110000-todos-title-index/)).toBeTruthy();
  });

  it("renders an empty pending list", () => {
    queryState.data = {applied: [], lock: null, pending: []};
    const {getByText} = renderView();
    expect(getByText("No pending migrations.")).toBeTruthy();
  });

  it("renders a failed task error", async () => {
    mockTask.data = {task: {error: "migrate exploded", status: "failed"}};
    const {getByTestId, getByText} = renderView();
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByTestId("admin-migrations-task")).toBeTruthy();
    expect(getByText(/migrate exploded/)).toBeTruthy();
  });

  it("disables apply while a queued task is in flight", async () => {
    mockTask.data = {task: {status: "queued"}};
    const {getByTestId, getByText} = renderView();
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByTestId("admin-migrations-task")).toBeTruthy();
    expect(getByTestId("admin-migrations-apply").props.accessibilityState.disabled).toBe(true);
  });

  it("refetches status after a completed task", async () => {
    mockTask.data = {task: {status: "completed"}};
    const {getByText} = renderView();
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("keeps apply disabled while a task is running", async () => {
    mockTask.data = {task: {status: "running"}};
    const {getByTestId, getByText} = renderView();
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByTestId("admin-migrations-apply").props.accessibilityState.disabled).toBe(true);
  });

  it("surfaces unwrap errors from run", async () => {
    mockRun.mockImplementationOnce(() => ({
      unwrap: async () => {
        throw new Error("cannot run");
      },
    }));
    const {getByTestId, getByText} = renderView();
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByTestId("admin-migrations-start-error")).toBeTruthy();
  });
});
