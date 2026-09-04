// noExplicitAny: test harness doubles for AdminScreenRouter routing and config mocks
// biome-ignore-all lint/suspicious/noExplicitAny: test harness doubles
import {beforeEach, describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "./types";

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

import {AdminScreenRouter} from "./AdminScreenRouter";

const adminApi = {
  injectEndpoints: ({endpoints}: {endpoints: (builder: unknown) => Record<string, unknown>}) => {
    endpoints({
      mutation: (spec: Record<string, unknown>) => spec,
      query: (spec: Record<string, unknown>) => spec,
    });
    return {
      useAdminVersionConfigQuery: () => ({data: null, error: null, isLoading: false}),
      useUpdateVersionConfigMutation: () => [
        () => ({unwrap: async () => ({})}),
        {isLoading: false},
      ],
    };
  },
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
