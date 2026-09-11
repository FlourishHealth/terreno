import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";

const queryState: {data?: unknown; error?: unknown; isLoading: boolean} = {
  isLoading: false,
};
const createOrganization = mock(() => ({unwrap: async () => ({})}));
const updateOrganization = mock(() => ({unwrap: async () => ({})}));
const queryOptions: unknown[] = [];

mock.module("./useOrganizationsApi", () => ({
  useOrganizationsApi: () => ({
    useCreateMutation: () => [createOrganization, {isLoading: false}],
    useListQuery: (_args: unknown, options: unknown) => {
      queryOptions.push(options);
      return queryState;
    },
    useUpdateMutation: () => [updateOrganization, {isLoading: false}],
  }),
}));

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

import type {AdminApi} from "../types";
import {OrgDirectoryScreen} from "./OrgDirectoryScreen";

const api = {} as unknown as AdminApi;

describe("OrgDirectoryScreen", () => {
  beforeEach(() => {
    queryState.data = {data: []};
    queryState.error = undefined;
    queryState.isLoading = false;
    createOrganization.mockClear();
    updateOrganization.mockClear();
    queryOptions.length = 0;
  });

  it("is hidden and skips loading organizations for non-operators", () => {
    const screen = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator={false} onEnterOrganization={mock(() => {})} />
    );

    expect(screen.queryByText("Organizations")).toBeNull();
    expect(queryOptions.at(-1)).toEqual({skip: true});
  });

  it("renders loading, error, and empty states", () => {
    queryState.isLoading = true;
    const loading = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator onEnterOrganization={mock(() => {})} />
    );
    expect(loading.getByTestId("org-directory-loading")).toBeTruthy();
    loading.unmount();

    queryState.isLoading = false;
    queryState.error = new Error("failed");
    const failed = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator onEnterOrganization={mock(() => {})} />
    );
    expect(failed.getByText("Could not load organizations.")).toBeTruthy();
    failed.unmount();

    queryState.error = undefined;
    const empty = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator onEnterOrganization={mock(() => {})} />
    );
    expect(empty.getByText("No organizations yet.")).toBeTruthy();
  });

  it("creates an organization and renders directory rows", async () => {
    queryState.data = {
      data: [{_id: "org-1", disabled: false, name: "Acme", slug: "acme"}],
    };
    const screen = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator onEnterOrganization={mock(() => {})} />
    );

    expect(screen.getByText("Acme")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId("org-directory-create"));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("org-directory-name"), "New Org");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Create"));
    });
    expect(createOrganization).toHaveBeenCalledWith({name: "New Org"});
  });

  it("renders directory rows from RTK-unwrapped list data", () => {
    queryState.data = [{_id: "org-1", disabled: false, name: "Acme", slug: "acme"}];
    const screen = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator onEnterOrganization={mock(() => {})} />
    );

    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByTestId("org-directory-table")).toBeTruthy();
  });

  it("opens and disables an organization from its row", async () => {
    const onEnterOrganization = mock(() => {});
    queryState.data = {
      data: [{_id: "org-1", disabled: false, name: "Acme", slug: "acme"}],
    };
    const screen = renderWithTheme(
      <OrgDirectoryScreen api={api} isOperator onEnterOrganization={onEnterOrganization} />
    );

    fireEvent(screen.getByLabelText("Open"), "click");
    expect(onEnterOrganization).toHaveBeenCalledWith({
      _id: "org-1",
      disabled: false,
      name: "Acme",
      slug: "acme",
    });
    await act(async () => {
      fireEvent(screen.getByLabelText("Disable"), "click");
    });
    expect(updateOrganization).toHaveBeenCalledWith({
      body: {disabled: true},
      id: "org-1",
    });
  });
});
