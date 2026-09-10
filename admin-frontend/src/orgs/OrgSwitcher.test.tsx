// noExplicitAny: test mock models type-erased RTK hooks.
// biome-ignore-all lint/suspicious/noExplicitAny: test-only dynamic hook doubles
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";

const mineState: {data?: unknown; error?: unknown; isLoading: boolean} = {isLoading: false};
const routerPush = mock(() => {});

mock.module("./useOrganizationsApi", () => ({
  useOrganizationsApi: () => ({
    useMineQuery: () => mineState,
  }),
}));
mock.module("expo-router", () => ({router: {push: routerPush}}));

import {OrgSwitcher} from "./OrgSwitcher";
import {OrgContextProvider} from "./useOrgContext";

const api = {} as any;

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
