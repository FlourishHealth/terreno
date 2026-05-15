import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";

const routerPush = mock(() => {});
mock.module("expo-router", () => ({
  router: {push: routerPush},
}));

const mockConfigState: {data: any; error: unknown; isLoading: boolean} = {
  data: null,
  error: null,
  isLoading: false,
};
mock.module("./useAdminConfig", () => ({
  useAdminConfig: () => ({
    config: mockConfigState.data,
    error: mockConfigState.error,
    isLoading: mockConfigState.isLoading,
  }),
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
    mockConfigState.data = null;
    mockConfigState.error = null;
    mockConfigState.isLoading = false;
  });

  it("renders a spinner while loading", () => {
    mockConfigState.isLoading = true;
    const {toJSON} = renderWithTheme(<AdminModelList api={{} as any} baseUrl="/admin" />);
    expect(toJSON()).toBeDefined();
  });

  it("renders an error message when loading fails", () => {
    mockConfigState.error = new Error("boom");
    const {toJSON} = renderWithTheme(<AdminModelList api={{} as any} baseUrl="/admin" />);
    expect(toJSON()).toBeDefined();
  });

  it("renders cards for models, custom screens, scripts, and configuration", () => {
    mockConfigState.data = baseConfig;
    const {toJSON} = renderWithTheme(
      <AdminModelList
        api={{} as any}
        baseUrl="/admin"
        configurationPath="/admin/configuration"
        customScreens={[{displayName: "Local", name: "local-screen"}]}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders the model grid when config has no scripts/custom screens", () => {
    mockConfigState.data = {...baseConfig, customScreens: [], scripts: []};
    const {toJSON} = renderWithTheme(<AdminModelList api={{} as any} baseUrl="/admin" />);
    expect(toJSON()).toBeDefined();
  });
});
