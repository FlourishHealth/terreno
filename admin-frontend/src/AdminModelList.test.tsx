// noExplicitAny: test mocks use type-erased RTK Query API doubles
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
import type {AdminApi, AdminConfigResponse} from "./types";

const routerPush = mock(() => {});
mock.module("expo-router", () => ({
  router: {push: routerPush},
}));

const mockConfigState: {data: AdminConfigResponse | null; error: unknown; isLoading: boolean} = {
  data: null,
  error: null,
  isLoading: false,
};
// Records the apiBase passed to useAdminConfig so tests can assert that data
// fetching uses the resolved API base (not the route base).
const configApiBaseCalls: string[] = [];
mock.module("./useAdminConfig", () => ({
  useAdminConfig: (_api: unknown, apiBase: string) => {
    configApiBaseCalls.push(apiBase);
    return {
      config: mockConfigState.data,
      error: mockConfigState.error,
      isLoading: mockConfigState.isLoading,
    };
  },
}));

import {AdminModelList} from "./AdminModelList";

const baseConfig = {
  customScreens: [
    {description: "Custom", displayName: "Dashboard", name: "dashboard"},
    {displayName: "Reports", name: "reports"},
  ],
  models: [
    {
      defaultSort: "-created",
      displayName: "User",
      fields: {_id: {required: true, type: "string"}, name: {required: false, type: "string"}},
      listFields: ["name"],
      name: "User",
      routePath: "/admin/users",
    },
  ],
  scripts: [{description: "migrate", name: "migrate"}],
};

describe("AdminModelList", () => {
  beforeEach(() => {
    routerPush.mockClear();
    configApiBaseCalls.length = 0;
    mockConfigState.data = null;
    mockConfigState.error = null;
    mockConfigState.isLoading = false;
  });

  it("renders a spinner while loading", () => {
    mockConfigState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders an error message when loading fails", () => {
    mockConfigState.error = new Error("boom");
    const {toJSON} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders models before tools when both sections are present", () => {
    mockConfigState.data = baseConfig;
    const {getByTestId, getByText} = renderWithTheme(
      <AdminModelList
        api={{} as unknown as AdminApi}
        baseUrl="/admin"
        configurationPath="/admin/configuration"
        customScreens={[{displayName: "Local", name: "local-screen"}]}
      />
    );
    expect(getByText("Tools")).toBeDefined();
    expect(getByText("Models")).toBeDefined();
    expect(getByTestId("admin-custom-screen-card-dashboard")).toBeDefined();
    expect(getByTestId("admin-custom-screen-card-local-screen")).toBeDefined();
    expect(getByTestId("admin-scripts-card")).toBeDefined();
    expect(getByTestId("admin-configuration-card")).toBeDefined();
    expect(getByTestId("admin-model-card-User")).toBeDefined();
  });

  it("renders only the model section when config has no tool cards", () => {
    mockConfigState.data = {...baseConfig, customScreens: [], scripts: []};
    const {getByTestId, getByText, queryByText} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(queryByText("Tools")).toBeNull();
    expect(getByText("Models")).toBeDefined();
    expect(getByTestId("admin-model-card-User")).toBeDefined();
  });

  it("fetches config from apiBase but navigates using routeBase when split", async () => {
    mockConfigState.data = {...baseConfig, customScreens: [], scripts: []};
    const {getByLabelText} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} apiBase="/admin" routeBase="/console" />
    );
    // Data fetching must use the API base.
    expect(configApiBaseCalls).toContain("/admin");
    // Card press must navigate using the route base, not the API base.
    await act(async () => {
      fireEvent.press(getByLabelText("User"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(routerPush).toHaveBeenCalledWith("/console/User");
  });

  it("uses baseUrl for both fetching and navigation (backward compat)", async () => {
    mockConfigState.data = {...baseConfig, customScreens: [], scripts: []};
    const {getByLabelText} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(configApiBaseCalls).toContain("/admin");
    await act(async () => {
      fireEvent.press(getByLabelText("User"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(routerPush).toHaveBeenCalledWith("/admin/User");
  });

  it("fetches config from apiBase but navigates using routeBase when split", async () => {
    mockConfigState.data = {...baseConfig, customScreens: [], scripts: []};
    const {getByLabelText} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} apiBase="/admin" routeBase="/console" />
    );
    // Data fetching must use the API base.
    expect(configApiBaseCalls).toContain("/admin");
    // Card press must navigate using the route base, not the API base.
    await act(async () => {
      fireEvent.press(getByLabelText("User"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(routerPush).toHaveBeenCalledWith("/console/User");
  });

  it("uses baseUrl for both fetching and navigation (backward compat)", async () => {
    mockConfigState.data = {...baseConfig, customScreens: [], scripts: []};
    const {getByLabelText} = renderWithTheme(
      <AdminModelList api={{} as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(configApiBaseCalls).toContain("/admin");
    await act(async () => {
      fireEvent.press(getByLabelText("User"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(routerPush).toHaveBeenCalledWith("/admin/User");
  });
});
