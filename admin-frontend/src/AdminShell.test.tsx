// noExplicitAny: test harness doubles
// biome-ignore-all lint/suspicious/noExplicitAny: test harness doubles
import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import type {ScaledSize} from "react-native";
import {useWindowDimensions} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import type {AdminApi, AdminConfigResponse} from "./types";

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
});
