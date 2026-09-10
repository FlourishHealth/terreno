// noExplicitAny: test mocks use type-erased RTK Query API doubles
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "./types";

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

mock.module("./useAdminMigrations", () => ({
  useAdminMigrations: () => ({
    useGetMigrationsQuery: () => ({
      data: {
        applied: [],
        lock: null,
        pending: [{checksum: "abc", id: "20260910120000-todos-title-owner-index"}],
      },
      error: null,
      isLoading: false,
      refetch: mock(() => {}),
    }),
    useRunMigrationsMutation: () => [mockRun, {isLoading: false}],
  }),
}));

mock.module("./useAdminScripts", () => ({
  useAdminScripts: () => ({
    useGetScriptTaskQuery: () => ({data: undefined, error: null, isLoading: false}),
  }),
}));

import {AdminMigrations} from "./AdminMigrations";

const mockApi = {} as unknown as AdminApi;

describe("AdminMigrations", () => {
  beforeEach(() => {
    mockUseAdminConfig.mockClear();
    mockRun.mockClear();
    mockUseAdminConfig.mockReturnValue({
      config: {migrations: {enabled: true}, models: [], scripts: []},
      error: null,
      isLoading: false,
    });
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
});
