// noExplicitAny: test mock models type-erased RTK hooks.
// biome-ignore-all lint/suspicious/noExplicitAny: test-only dynamic hook doubles
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../ui/src/test-utils";

const readState: {data?: unknown; error?: unknown; isLoading: boolean} = {isLoading: false};
const membersState: {data?: unknown; error?: unknown; isLoading: boolean} = {isLoading: false};
const updateOrganization = mock(() => ({unwrap: async () => ({})}));
const attachMember = mock(() => ({unwrap: async () => ({})}));
const updateMember = mock(() => ({unwrap: async () => ({})}));
const removeMember = mock(() => ({unwrap: async () => ({})}));

mock.module("./useOrganizationsApi", () => ({
  useOrganizationsApi: () => ({
    useMemberAttachMutation: () => [attachMember, {isLoading: false}],
    useMemberRemoveMutation: () => [removeMember, {isLoading: false}],
    useMembersQuery: () => membersState,
    useMemberUpdateMutation: () => [updateMember, {isLoading: false}],
    useReadQuery: () => readState,
    useUpdateMutation: () => [updateOrganization, {isLoading: false}],
  }),
}));
mock.module("expo-router", () => ({router: {push: mock(() => {})}}));

import {OrgMembersScreen} from "./OrgMembersScreen";
import {OrgSettingsScreen} from "./OrgSettingsScreen";

const api = {} as any;

describe("organization management screens", () => {
  beforeEach(() => {
    readState.data = {data: {_id: "org-1", name: "Acme", settings: {region: "us"}}};
    readState.error = undefined;
    readState.isLoading = false;
    membersState.data = {
      data: [
        {
          _id: "membership-1",
          roleName: "org-admin",
          status: "active",
          userId: {_id: "user-1", email: "admin@example.com", name: "Admin"},
        },
      ],
    };
    membersState.error = undefined;
    membersState.isLoading = false;
    updateOrganization.mockClear();
    attachMember.mockClear();
    updateMember.mockClear();
    removeMember.mockClear();
    attachMember.mockImplementation(() => ({unwrap: async () => ({})}));
    updateMember.mockImplementation(() => ({unwrap: async () => ({})}));
    removeMember.mockImplementation(() => ({unwrap: async () => ({})}));
  });

  it("saves organization settings and shows the billing placeholder", async () => {
    const screen = renderWithTheme(
      <OrgSettingsScreen api={api} organizationId="org-1" routeBase="/admin" />
    );
    expect(screen.getByText("Billing is not available yet.")).toBeTruthy();
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("org-settings-name"), "Acme Updated");
      fireEvent.changeText(screen.getByTestId("org-settings-json"), '{"region":"eu"}');
    });
    await act(async () => {
      fireEvent(screen.getByTestId("org-settings-save"), "click");
    });
    expect(updateOrganization).toHaveBeenCalledWith({
      body: {name: "Acme Updated", settings: {region: "eu"}},
      id: "org-1",
    });
  });

  it("shows disabled Invite and attaches an existing user", async () => {
    const screen = renderWithTheme(<OrgMembersScreen api={api} organizationId="org-1" />);
    expect(screen.getByLabelText("Invite").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("admin@example.com")).toBeTruthy();
    await act(async () => {
      fireEvent(screen.getByTestId("org-members-add"), "click");
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("org-members-email"), "New@Example.com");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Add member"));
    });
    expect(attachMember).toHaveBeenCalledWith({
      body: {email: "new@example.com", roleName: "member"},
      id: "org-1",
    });
  });

  it("renders members from RTK-unwrapped list data", () => {
    membersState.data = [
      {
        _id: "membership-1",
        roleName: "org-admin",
        status: "active",
        userId: {_id: "user-1", email: "admin@example.com", name: "Admin"},
      },
    ];
    const screen = renderWithTheme(<OrgMembersScreen api={api} organizationId="org-1" />);

    expect(screen.getByText("admin@example.com")).toBeTruthy();
    expect(screen.getByTestId("org-members-table")).toBeTruthy();
  });

  it("shows the backend last-admin error", async () => {
    updateMember.mockImplementation(() => ({
      unwrap: async () => Promise.reject({data: {title: "Cannot remove the last org-admin"}}),
    }));
    const screen = renderWithTheme(<OrgMembersScreen api={api} organizationId="org-1" />);

    await act(async () => {
      fireEvent(screen.getByLabelText("Make member"), "click");
    });
    await waitFor(() => {
      expect(screen.getByText("Cannot remove the last org-admin")).toBeTruthy();
    });
  });

  it("shows attach errors inside the open modal", async () => {
    attachMember.mockImplementation(() => ({
      unwrap: async () => Promise.reject({data: {title: "User not found"}}),
    }));
    const screen = renderWithTheme(<OrgMembersScreen api={api} organizationId="org-1" />);
    await act(async () => {
      fireEvent(screen.getByTestId("org-members-add"), "click");
    });
    await act(async () => {
      fireEvent.changeText(screen.getByTestId("org-members-email"), "missing@example.com");
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Add member"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("org-members-add-modal")).toBeTruthy();
      expect(screen.getByText("User not found")).toBeTruthy();
    });
  });

  it("removes a member from the row action", async () => {
    const screen = renderWithTheme(<OrgMembersScreen api={api} organizationId="org-1" />);
    await act(async () => {
      fireEvent(screen.getByLabelText("Remove"), "click");
    });
    expect(removeMember).toHaveBeenCalledWith({
      body: {},
      id: "org-1",
      memberId: "membership-1",
    });
  });
});
