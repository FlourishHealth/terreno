import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {Text} from "react-native";
import {renderWithTheme} from "../../../ui/src/test-utils";
import {OrgSettingsScreen} from "./OrgSettingsScreen";
import {OrgSwitcher} from "./OrgSwitcher";
import {OrgContextProvider, useOrgContext} from "./useOrgContext";

const mineState: {data?: unknown; error?: unknown; isLoading: boolean} = {isLoading: false};
const readState: {
  data?: unknown;
  error?: unknown;
  isFetching: boolean;
  isLoading: boolean;
} = {
  data: {_id: "org-alpha", name: "Alpha Workspace"},
  isFetching: false,
  isLoading: false,
};
const routerPush = mock(() => {});

mock.module("expo-router", () => ({router: {push: routerPush}}));

import type {AdminApi} from "../types";

const createApi = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useOrgMineQuery: () => mineState,
      useOrgReadQuery: () => readState,
      useOrgUpdateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    }),
  };
  return api as unknown as AdminApi;
};

const ContextProbe: React.FC = () => {
  const {organization} = useOrgContext();
  return <Text testID="org-context-probe">{organization?.name ?? "none"}</Text>;
};

describe("org switcher oscillation", () => {
  const api = createApi();

  beforeEach(() => {
    mineState.data = {
      data: [
        {_id: "org-alpha", name: "Alpha Workspace"},
        {_id: "org-beta", name: "Beta Workspace"},
      ],
    };
    mineState.error = undefined;
    mineState.isLoading = false;
    readState.data = {_id: "org-alpha", name: "Alpha Workspace"};
    readState.error = undefined;
    readState.isFetching = false;
    readState.isLoading = false;
    routerPush.mockClear();
  });

  it("keeps switcher selection when OrgSettingsScreen still serves the previous route org", async () => {
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-alpha", name: "Alpha Workspace"}}>
        <OrgSwitcher api={api} routeBase="/admin" />
        <OrgSettingsScreen api={api} organizationId="org-alpha" routeBase="/admin" />
        <ContextProbe />
      </OrgContextProvider>
    );

    await act(async () => {
      fireEvent(screen.getByTestId("web_dropdown_option_org-beta"), "press");
    });

    expect(routerPush).toHaveBeenCalledWith("/admin/orgs/org-beta");
    expect(screen.getByTestId("org-context-probe").props.children).toBe("Beta Workspace");
  });

  it("ignores stale RTK read data for a different route organization id", () => {
    readState.data = {_id: "org-alpha", name: "Alpha Workspace"};
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-beta", name: "Beta Workspace"}}>
        <OrgSwitcher api={api} routeBase="/admin" />
        <OrgSettingsScreen api={api} organizationId="org-beta" routeBase="/admin" />
        <ContextProbe />
      </OrgContextProvider>
    );

    expect(screen.queryByTestId("org-settings-save")).toBeNull();
    expect(screen.getByTestId("org-context-probe").props.children).toBe("Beta Workspace");
  });

  it("renders beta settings after the route-scoped read query catches up", async () => {
    readState.data = {_id: "org-beta", name: "Beta Workspace"};
    const screen = renderWithTheme(
      <OrgContextProvider initialOrganization={{_id: "org-beta", name: "Beta Workspace"}}>
        <OrgSwitcher api={api} routeBase="/admin" />
        <OrgSettingsScreen api={api} organizationId="org-beta" routeBase="/admin" />
        <ContextProbe />
      </OrgContextProvider>
    );

    expect(screen.getByTestId("org-settings-save")).toBeTruthy();
    expect(screen.getByTestId("org-context-probe").props.children).toBe("Beta Workspace");
  });
});
