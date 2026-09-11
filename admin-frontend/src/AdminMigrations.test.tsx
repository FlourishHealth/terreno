import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse, BackgroundTask} from "./types";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const mockUseAdminConfig = mock(() => ({
  config: null as AdminConfigResponse | null,
  error: null as Error | null,
  isLoading: false,
}));

mock.module("./useAdminConfig", () => ({
  useAdminConfig: (...args: unknown[]) => mockUseAdminConfig(...args),
}));

const mockRun = mock((_args: {wetRun: boolean}) => ({
  unwrap: async () => ({taskId: "task-1"}),
}));

const mockRefetch = mock(() => {});

const mockUseAdminMigrations = mock(() => ({
  useGetMigrationsQuery: () => ({
    data: {
      applied: [] as Array<{appliedAt?: string; checksum: string; id: string}>,
      lock: null as {expiresAt: string; holder: string} | null,
      pending: [{checksum: "abc", id: "20260910120000-todos-title-owner-index"}],
    },
    error: null as Error | null,
    isLoading: false,
    refetch: mockRefetch,
  }),
  useRunMigrationsMutation: () => [mockRun, {isLoading: false}],
}));

mock.module("./useAdminMigrations", () => ({
  useAdminMigrations: (...args: unknown[]) => mockUseAdminMigrations(...args),
}));

const mockTask = {
  data: undefined as {task?: BackgroundTask} | undefined,
};

mock.module("./useAdminScripts", () => ({
  useAdminScripts: () => ({
    useGetScriptTaskQuery: () => mockTask,
  }),
}));

import {AdminMigrations} from "./AdminMigrations";

const mockApi = {} as unknown as AdminApi;

const enabledConfig = {
  config: {migrations: {enabled: true}, models: [], scripts: []} as AdminConfigResponse,
  error: null,
  isLoading: false,
};

describe("AdminMigrations", () => {
  beforeEach(() => {
    mockUseAdminConfig.mockClear();
    mockRun.mockClear();
    mockRefetch.mockClear();
    mockTask.data = undefined;
    mockUseAdminConfig.mockReturnValue(enabledConfig);
    mockUseAdminMigrations.mockReturnValue({
      useGetMigrationsQuery: () => ({
        data: {
          applied: [],
          lock: null,
          pending: [{checksum: "abc", id: "20260910120000-todos-title-owner-index"}],
        },
        error: null,
        isLoading: false,
        refetch: mockRefetch,
      }),
      useRunMigrationsMutation: () => [mockRun, {isLoading: false}],
    });
  });

  it("renders a spinner while admin config loads", () => {
    mockUseAdminConfig.mockReturnValue({
      config: null,
      error: null,
      isLoading: true,
    });
    const {getByTestId} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(getByTestId("admin-migrations-loading")).toBeTruthy();
  });

  it("renders a config error", () => {
    mockUseAdminConfig.mockReturnValue({
      config: null,
      error: new Error("network"),
      isLoading: false,
    });
    const {getByTestId} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(getByTestId("admin-migrations-config-error")).toBeTruthy();
  });

  it("renders a disabled message when migrations are not configured", () => {
    mockUseAdminConfig.mockReturnValue({
      config: {migrations: {enabled: false}, models: [], scripts: []},
      error: null,
      isLoading: false,
    });
    const {getByText} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(getByText("Migrations are not configured on this server.")).toBeTruthy();
  });

  it("lists pending files and starts a dry-run", async () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AdminMigrations api={mockApi} baseUrl="/admin" />
    );

    expect(getByTestId("admin-migrations")).toBeTruthy();
    expect(getByText("20260910120000-todos-title-owner-index")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(mockRun).toHaveBeenCalledWith({wetRun: false});
  });

  it("starts a wet apply", async () => {
    const {getByText} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    await act(async () => {
      fireEvent.press(getByText("Apply pending"));
    });
    expect(mockRun).toHaveBeenCalledWith({wetRun: true});
  });

  it("surfaces start failures from unwrap", async () => {
    mockRun.mockImplementationOnce(() => ({
      unwrap: async () => {
        throw {data: {title: "Migrations not allowed"}};
      },
    }));
    const {getByTestId, getByText} = renderWithTheme(
      <AdminMigrations api={mockApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByTestId("admin-migrations-start-error")).toBeTruthy();
    expect(getByText("Migrations not allowed")).toBeTruthy();
  });

  it("shows status load errors", () => {
    mockUseAdminMigrations.mockReturnValue({
      useGetMigrationsQuery: () => ({
        data: undefined,
        error: new Error("status failed"),
        isLoading: false,
        refetch: mockRefetch,
      }),
      useRunMigrationsMutation: () => [mockRun, {isLoading: false}],
    });
    const {getByText} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(getByText("Failed to load migration status.")).toBeTruthy();
  });

  it("renders a spinner while migration status loads", () => {
    mockUseAdminMigrations.mockReturnValue({
      useGetMigrationsQuery: () => ({
        data: undefined,
        error: null,
        isLoading: true,
        refetch: mockRefetch,
      }),
      useRunMigrationsMutation: () => [mockRun, {isLoading: false}],
    });
    const {getByTestId} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(getByTestId("admin-migrations")).toBeTruthy();
  });

  it("uses a fallback start error when unwrap has no title", async () => {
    mockRun.mockImplementationOnce(() => ({
      unwrap: async () => {
        throw new Error("network");
      },
    }));
    const {getByText} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByText("Failed to start migrations")).toBeTruthy();
  });

  it("shows a lock banner and applied timestamps", () => {
    mockUseAdminMigrations.mockReturnValue({
      useGetMigrationsQuery: () => ({
        data: {
          applied: [
            {
              appliedAt: "2026-09-10T12:00:00.000Z",
              checksum: "a",
              id: "20260910120000-alpha",
            },
            {checksum: "b", id: "20260910120001-beta"},
            {appliedAt: "not-iso", checksum: "c", id: "20260910120002-gamma"},
          ],
          lock: {expiresAt: "2026-09-10T12:10:00.000Z", holder: "runner-1"},
          pending: [],
        },
        error: null,
        isLoading: false,
        refetch: mockRefetch,
      }),
      useRunMigrationsMutation: () => [mockRun, {isLoading: false}],
    });
    const {getByText} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(getByText("Lock held by runner-1")).toBeTruthy();
    expect(getByText("20260910120000-alpha · 2026-09-10 12:00:00 UTC")).toBeTruthy();
    expect(getByText("20260910120001-beta")).toBeTruthy();
    expect(getByText("20260910120002-gamma · not-iso")).toBeTruthy();
  });

  it("disables Dry run while a task is in flight and shows task logs", async () => {
    mockTask.data = {
      task: {
        error: undefined,
        logs: [{level: "info", message: "started", timestamp: "t0"}],
        result: ["20260910120000-alpha"],
        status: "running",
      } as BackgroundTask,
    };
    mockRun.mockImplementationOnce(() => ({
      unwrap: async () => ({taskId: "task-busy"}),
    }));
    const {getByTestId, getByText} = renderWithTheme(
      <AdminMigrations api={mockApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.press(getByText("Dry run"));
    });
    expect(getByTestId("admin-migrations-task")).toBeTruthy();
    expect(getByText("Dry run running")).toBeTruthy();
    expect(getByText("started")).toBeTruthy();
    expect(getByText("20260910120000-alpha")).toBeTruthy();
  });

  it("shows apply failure details on the task card", async () => {
    mockTask.data = {
      task: {
        error: "boom",
        logs: [],
        result: [],
        status: "failed",
      } as BackgroundTask,
    };
    mockRun.mockImplementationOnce(() => ({
      unwrap: async () => ({taskId: "task-fail"}),
    }));
    const {getByText} = renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    await act(async () => {
      fireEvent.press(getByText("Apply pending"));
    });
    expect(getByText("Apply failed: boom")).toBeTruthy();
  });

  it("refetches status after a task completes", () => {
    mockTask.data = {
      task: {
        logs: [],
        result: [],
        status: "completed",
      } as BackgroundTask,
    };
    renderWithTheme(<AdminMigrations api={mockApi} baseUrl="/admin" />);
    expect(mockRefetch).toHaveBeenCalled();
  });
});
