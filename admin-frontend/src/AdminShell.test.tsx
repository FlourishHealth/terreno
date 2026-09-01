// noExplicitAny: test harness doubles
// biome-ignore-all lint/suspicious/noExplicitAny: test harness doubles
import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import type {ScaledSize} from "react-native";
import {useWindowDimensions} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse, AdminModelConfig} from "./types";

const mockRouterPush = mock((_href: string) => {});

mock.module("expo-router", () => ({
  router: {push: mockRouterPush},
}));

const configState: {
  config: AdminConfigResponse | null;
  error: Error | null;
  isLoading: boolean;
} = {
  config: null,
  error: null,
  isLoading: false,
};

mock.module("./useAdminConfig", () => ({
  useAdminConfig: () => ({
    config: configState.config,
    error: configState.error,
    isLoading: configState.isLoading,
  }),
}));

import {AdminShell} from "./AdminShell";

type WindowDimensionsImpl = () => ScaledSize;
type MockableUseWindowDimensions = WindowDimensionsImpl & {
  mockImplementation?: (impl: WindowDimensionsImpl) => void;
};

const getScaledSize =
  (width: number): WindowDimensionsImpl =>
  (): ScaledSize => ({
    fontScale: 1,
    height: 1000,
    scale: 2,
    width,
  });

const setWindowWidth = (width: number): (() => void) => {
  const useWindowDimensionsMock = useWindowDimensions as MockableUseWindowDimensions;
  const dimensionsImpl = getScaledSize(width);

  if (typeof useWindowDimensionsMock.mockImplementation === "function") {
    useWindowDimensionsMock.mockImplementation(dimensionsImpl);

    return (): void => {
      useWindowDimensionsMock.mockImplementation(getScaledSize(375));
    };
  }

  return (): void => {};
};

const buildConfig = (): AdminConfigResponse => ({
  customScreens: [],
  models: [
    {
      defaultSort: "-created",
      displayName: "Todos",
      fields: {title: {required: true, type: "string"}},
      listFields: ["title"],
      name: "Todo",
      routePath: "/admin/todos",
    },
  ],
  scripts: [{description: "Seed", name: "seed"}],
});

const platformModel = ({
  displayName,
  name,
  routePath,
}: Pick<AdminModelConfig, "displayName" | "name" | "routePath">): AdminModelConfig => ({
  defaultSort: "-created",
  displayName,
  fields: {name: {required: true, type: "string"}},
  group: "Platform",
  listFields: ["name"],
  name,
  routePath,
});

const mockApi = {} as unknown as AdminApi;

describe("AdminShell", () => {
  let restoreWindowWidth: (() => void) | undefined;

  beforeEach(() => {
    configState.config = buildConfig();
    configState.error = null;
    configState.isLoading = false;
    mockRouterPush.mockClear();
    restoreWindowWidth = setWindowWidth(375);
  });

  afterEach(() => {
    restoreWindowWidth?.();
    restoreWindowWidth = undefined;
  });

  it("shows the fixed sidebar on desktop widths", () => {
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);

    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    expect(getByTestId("admin-shell-sidebar")).toBeTruthy();
    expect(queryByTestId("admin-shell-menu-button")).toBeNull();
    expect(queryByTestId("admin-shell-mobile-header")).toBeNull();
  });

  it("shows a forbidden state when admin config returns 403", () => {
    configState.config = null;
    configState.error = {status: 403} as unknown as Error;
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);

    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    expect(getByTestId("admin-shell-forbidden")).toBeTruthy();
    expect(queryByTestId("admin-shell-error")).toBeNull();
    expect(queryByTestId("admin-shell-sidebar")).toBeNull();
  });

  it("hides the fixed sidebar and shows a hamburger header below 768px", () => {
    const {getByTestId, getByLabelText, queryByTestId, UNSAFE_root} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    expect(queryByTestId("admin-shell-sidebar")).toBeNull();
    expect(getByTestId("admin-shell-mobile-header")).toBeTruthy();
    expect(getByTestId("admin-shell-menu-button-clickable")).toBeTruthy();
    expect(getByLabelText("Open navigation menu")).toBeTruthy();
    expect(UNSAFE_root.findAllByType(SafeAreaView)).toHaveLength(1);
  });

  it("opens and closes the navigation drawer from the hamburger menu", async () => {
    const {getByTestId, getByLabelText, queryByTestId} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    expect(queryByTestId("admin-shell-drawer")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-menu-button-clickable"));
    });

    expect(getByTestId("admin-shell-drawer")).toBeTruthy();
    expect(getByTestId("admin-shell-drawer-backdrop-clickable")).toBeTruthy();
    expect(getByLabelText("Close navigation menu")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-drawer-close-clickable"));
    });

    expect(queryByTestId("admin-shell-drawer")).toBeNull();
  });

  it("closes the drawer when the backdrop is pressed", async () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-menu-button-clickable"));
    });
    expect(getByTestId("admin-shell-drawer")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-drawer-backdrop-clickable"));
    });

    expect(queryByTestId("admin-shell-drawer")).toBeNull();
  });

  it("closes the drawer after selecting a navigation item", async () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-menu-button-clickable"));
    });
    expect(getByTestId("admin-shell-drawer")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-nav-home-clickable"));
    });

    expect(mockRouterPush).toHaveBeenCalled();
    expect(queryByTestId("admin-shell-drawer")).toBeNull();
  });

  it("renders the ordered Platform block last and removes its models from Models", async () => {
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);
    configState.config = {
      ...buildConfig(),
      models: [
        ...buildConfig().models,
        platformModel({
          displayName: "Audit Logs",
          name: "AdminAuditLog",
          routePath: "/admin/audit-logs",
        }),
        platformModel({
          displayName: "Feature Flags",
          name: "FeatureFlag",
          routePath: "/admin/feature-flags",
        }),
      ],
    };

    const {getByTestId, queryByTestId, queryByText} = renderWithTheme(
      <AdminShell
        api={mockApi}
        apiBase="/admin"
        configurationPath="/admin/configuration"
        rolesPath="/roles"
        routeBase="/admin"
      >
        <React.Fragment />
      </AdminShell>
    );

    const platform = getByTestId("admin-shell-nav-platform");
    const platformLinkTestIDs = platform
      .findAll((node: ReactTestInstance) => typeof node.props.testID === "string")
      .map((node: ReactTestInstance) => node.props.testID)
      .filter((testID: string) => testID.startsWith("admin-shell-nav-"))
      .filter((testID: string) => !testID.endsWith("-clickable"))
      .filter((testID: string, index: number, testIDs: string[]) => {
        return testIDs.indexOf(testID) === index;
      });
    expect(platformLinkTestIDs).toEqual([
      "admin-shell-nav-platform",
      "admin-shell-nav-scripts",
      "admin-shell-nav-roles",
      "admin-shell-nav-version",
      "admin-shell-nav-audit-log",
      "admin-shell-nav-feature-flags",
      "admin-shell-nav-configuration",
    ]);
    expect(queryByText("Tools")).toBeNull();
    expect(queryByTestId("admin-shell-nav-model-AdminAuditLog")).toBeNull();
    expect(queryByTestId("admin-shell-nav-model-FeatureFlag")).toBeNull();

    await act(async () => {
      fireEvent.press(getByTestId("admin-shell-nav-audit-log-clickable"));
    });
    expect(mockRouterPush).toHaveBeenLastCalledWith("/admin/AdminAuditLog");
  });

  it("hides built-in platform tools denied by backend RBAC metadata", () => {
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);
    configState.config = {
      ...buildConfig(),
      platformTools: {
        configuration: false,
        roles: false,
        scripts: false,
        version: false,
      },
    };

    const {queryByTestId} = renderWithTheme(
      <AdminShell
        api={mockApi}
        apiBase="/admin"
        configurationPath="/admin/configuration"
        customScreens={[{displayName: "Denied local screen", name: "denied"}]}
        rolesPath="/roles"
        routeBase="/admin"
      >
        <React.Fragment />
      </AdminShell>
    );

    assert.isNull(queryByTestId("admin-shell-nav-scripts"));
    assert.isNull(queryByTestId("admin-shell-nav-roles"));
    assert.isNull(queryByTestId("admin-shell-nav-version"));
    assert.isNull(queryByTestId("admin-shell-nav-configuration"));
    assert.isNull(queryByTestId("admin-shell-nav-screen-denied"));
  });

  it("shows only the platform tools and models granted to the current role", () => {
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);
    configState.config = {
      ...buildConfig(),
      models: [
        {
          ...buildConfig().models[0],
          permissions: {create: false, delete: false, update: false},
        },
      ],
      platformTools: {
        configuration: false,
        roles: true,
        scripts: false,
        version: false,
      },
    };

    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminShell
        api={mockApi}
        apiBase="/admin"
        configurationPath="/admin/configuration"
        rolesPath="/roles"
        routeBase="/admin"
      >
        <React.Fragment />
      </AdminShell>
    );

    assert.isNotNull(getByTestId("admin-shell-nav-model-Todo-clickable"));
    assert.isNotNull(getByTestId("admin-shell-nav-roles-clickable"));
    assert.isNull(queryByTestId("admin-shell-nav-scripts"));
    assert.isNull(queryByTestId("admin-shell-nav-version"));
    assert.isNull(queryByTestId("admin-shell-nav-configuration"));
  });

  it("hides empty Models and Screens headings", () => {
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);
    configState.config = {
      customScreens: [],
      models: [
        platformModel({
          displayName: "Audit Logs",
          name: "AdminAuditLog",
          routePath: "/admin/audit-logs",
        }),
        platformModel({
          displayName: "Feature Flags",
          name: "FeatureFlag",
          routePath: "/admin/feature-flags",
        }),
      ],
      scripts: [],
    };

    const {getByText, queryByText} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    expect(queryByText("Models")).toBeNull();
    expect(queryByText("Screens")).toBeNull();
    expect(queryByText("Tools")).toBeNull();
    expect(getByText("Platform")).toBeTruthy();
  });

  it("renders grouped custom screens separately from ungrouped Screens", () => {
    restoreWindowWidth?.();
    restoreWindowWidth = setWindowWidth(1024);
    configState.config = {
      ...buildConfig(),
      customScreens: [
        {displayName: "AI Requests", name: "ai-requests"},
        {displayName: "Prompts", group: "AI Observability", name: "ai-prompts"},
        {displayName: "Traces", group: "AI Observability", name: "ai-traces"},
        {displayName: "Review queue", group: "AI Observability", name: "ai-review"},
      ],
    };

    const {getByTestId, getByText} = renderWithTheme(
      <AdminShell api={mockApi} apiBase="/admin" routeBase="/admin">
        <React.Fragment />
      </AdminShell>
    );

    expect(getByTestId("admin-shell-nav-group-ai-observability")).toBeTruthy();
    expect(getByText("AI Observability")).toBeTruthy();
    expect(getByTestId("admin-shell-nav-screen-ai-prompts-clickable")).toBeTruthy();
    expect(getByTestId("admin-shell-nav-screen-ai-review-clickable")).toBeTruthy();
    expect(getByTestId("admin-shell-nav-screens")).toBeTruthy();
    expect(getByTestId("admin-shell-nav-screen-ai-requests-clickable")).toBeTruthy();
  });
});
