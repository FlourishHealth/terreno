import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";

const mineState: {data?: unknown; error?: unknown; isLoading: boolean} = {isLoading: false};
const routerPush = mock(() => {});

mock.module("expo-router", () => ({router: {push: routerPush}}));

import type {AdminApi} from "../types";
import {OrgSwitcher} from "./OrgSwitcher";
import {OrgContextProvider} from "./useOrgContext";

/**
 * Stands in for the host RTK Query API so the real `useOrganizationsApi` runs.
 * Mocking that module instead would leak process-wide and make the suite order-dependent.
 */
const createOrganizationsApi = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useOrgCreateMutation: () => [mock(() => ({})), {isLoading: false}],
      useOrgDeleteMutation: () => [mock(() => ({})), {isLoading: false}],
      useOrgListQuery: () => ({isLoading: false}),
      useOrgMemberAttachMutation: () => [mock(() => ({})), {isLoading: false}],
      useOrgMemberRemoveMutation: () => [mock(() => ({})), {isLoading: false}],
      useOrgMembersQuery: () => ({isLoading: false}),
      useOrgMemberUpdateMutation: () => [mock(() => ({})), {isLoading: false}],
      useOrgMineQuery: () => mineState,
      useOrgReadQuery: () => ({isLoading: false}),
      useOrgUpdateMutation: () => [mock(() => ({})), {isLoading: false}],
    }),
  };
  return api as unknown as AdminApi;
};

const api = createOrganizationsApi();

describe("OrgSwitcher", () => {
  beforeEach(() => {
    mineState.data = {data: []};
    mineState.error = undefined;
    mineState.isLoading = false;
    routerPush.mockClear();
  });

  it("renders the organization name for a single-org admin", async () => {
    mineState.data = {data: [{_id: "org-1", name: "Only Org"}]};
    const changed = mock(() => {});
    const screen = renderWithTheme(
      <OrgContextProvider onOrganizationChange={changed}>
        <OrgSwitcher api={api} />
      </OrgContextProvider>
    );

    expect(screen.getByText("Only Org")).toBeTruthy();
    await act(async () => {});
    expect(changed).toHaveBeenCalledWith({_id: "org-1", name: "Only Org"});
    fireEvent(screen.getByTestId("org-switcher-single-open"), "click");
    expect(routerPush).toHaveBeenCalledWith("/admin/orgs/org-1");
  });

  it("renders organizations from RTK-unwrapped list data", async () => {
    mineState.data = [{_id: "org-1", name: "Only Org"}];
    const changed = mock(() => {});
    const screen = renderWithTheme(
      <OrgContextProvider onOrganizationChange={changed}>
        <OrgSwitcher api={api} />
      </OrgContextProvider>
    );

    expect(screen.getByText("Only Org")).toBeTruthy();
    await act(async () => {});
    expect(changed).toHaveBeenCalledWith({_id: "org-1", name: "Only Org"});
  });

  it("selects an organization and navigates to its URL", async () => {
    mineState.data = {
      data: [
        {_id: "org-1", name: "First"},
        {_id: "org-2", name: "Second"},
      ],
    };
    const changed = mock(() => {});
    const screen = renderWithTheme(
      <OrgContextProvider onOrganizationChange={changed}>
        <OrgSwitcher api={api} routeBase="/admin" />
      </OrgContextProvider>
    );

    await act(async () => {
      fireEvent(screen.getByTestId("web_dropdown_option_org-2"), "press");
    });
    expect(changed).toHaveBeenCalledWith({_id: "org-2", name: "Second"});
    expect(routerPush).toHaveBeenCalledWith("/admin/orgs/org-2");
  });
});
