// noExplicitAny: test mocks use type-erased RTK Query API doubles and dynamic mock returns
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {AdminRolesList} from "./AdminRolesList";
import type {AdminApi} from "./types";
import {normalizeRoles, normalizeStatements, type RolesQueryResult} from "./useAdminRoles";

const mockUseListRolesQuery = mock(
  (): RolesQueryResult => ({data: undefined, error: null, isLoading: false})
);
const mockRefetch = mock(() => {});
const mockCreateRole = mock(() => ({unwrap: async () => ({})}));
const mockUpdateRole = mock(() => ({unwrap: async () => ({})}));
const mockUseListStatementsQuery = mock(() => ({
  data: {statements: {admin: ["access", "runScripts"], todo: ["read", "update"]}},
  error: null,
  isLoading: false,
}));

mock.module("./useAdminRoles", () => ({
  normalizeRoles,
  normalizeStatements,
  useAdminRoles: () => ({
    useCreateRoleMutation: () => [mockCreateRole, {isLoading: false}],
    useListRolesQuery: mockUseListRolesQuery,
    useListStatementsQuery: mockUseListStatementsQuery,
    useUpdateRoleMutation: () => [mockUpdateRole, {isLoading: false}],
  }),
}));

const mockApi = {} as unknown as AdminApi;

const ROLES = [
  {displayName: "Super Admin", isLocked: true, isSealed: true, name: "superadmin"},
  {description: "Baseline role for signed-up users", displayName: "Todo User", name: "todoUser"},
];

describe("AdminRolesList", () => {
  beforeEach(() => {
    mockUseListRolesQuery.mockClear();
    mockCreateRole.mockClear();
    mockUpdateRole.mockClear();
    mockUseListStatementsQuery.mockClear();
    mockUseListStatementsQuery.mockClear();
    mockUseListRolesQuery.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: false,
      refetch: mockRefetch,
    });
  });

  it("renders a spinner while loading", () => {
    mockUseListRolesQuery.mockReturnValue({data: undefined, error: null, isLoading: true});

    const {getByTestId} = renderWithTheme(<AdminRolesList api={mockApi} apiBase="/admin" />);

    expect(getByTestId("admin-roles-loading")).toBeTruthy();
  });

  it("renders an error state when the request fails", () => {
    mockUseListRolesQuery.mockReturnValue({
      data: undefined,
      error: new Error("boom"),
      isLoading: false,
    });

    const {getByTestId} = renderWithTheme(<AdminRolesList api={mockApi} apiBase="/admin" />);

    expect(getByTestId("admin-roles-error")).toBeTruthy();
  });

  it("renders roles returned as a bare array", () => {
    mockUseListRolesQuery.mockReturnValue({data: ROLES, error: null, isLoading: false});

    const {getByTestId, getByText} = renderWithTheme(
      <AdminRolesList api={mockApi} apiBase="/admin" />
    );

    expect(getByTestId("admin-roles-item-superadmin")).toBeTruthy();
    expect(getByTestId("admin-roles-item-todoUser")).toBeTruthy();
    expect(getByText("Super Admin")).toBeTruthy();
    expect(getByText("Todo User")).toBeTruthy();
  });

  it("lists available permissions and exposes role creation", () => {
    mockUseListRolesQuery.mockReturnValue({
      data: ROLES,
      error: null,
      isLoading: false,
      refetch: mockRefetch,
    });
    const {getByTestId, getByText} = renderWithTheme(
      <AdminRolesList api={mockApi} apiBase="/admin" />
    );

    expect(getByTestId("admin-permissions-list")).toBeTruthy();
    expect(getByText("admin:runScripts")).toBeTruthy();
    expect(getByTestId("admin-roles-add-button")).toBeTruthy();
  });

  it("enables editing for non-sealed roles and disables sealed roles", () => {
    mockUseListRolesQuery.mockReturnValue({
      data: ROLES,
      error: null,
      isLoading: false,
      refetch: mockRefetch,
    });
    const {getByTestId} = renderWithTheme(<AdminRolesList api={mockApi} apiBase="/admin" />);

    expect(getByTestId("admin-roles-edit-todoUser").props.disabled).toBeFalsy();
    expect(getByTestId("admin-roles-edit-superadmin").props.disabled).toBeTruthy();
  });

  it("renders roles returned inside a data envelope", () => {
    mockUseListRolesQuery.mockReturnValue({data: {data: ROLES}, error: null, isLoading: false});

    const {getByTestId} = renderWithTheme(<AdminRolesList api={mockApi} apiBase="/admin" />);

    expect(getByTestId("admin-roles-item-superadmin")).toBeTruthy();
  });

  it("renders an empty state when there are no roles", () => {
    mockUseListRolesQuery.mockReturnValue({data: [], error: null, isLoading: false});

    const {getByText} = renderWithTheme(<AdminRolesList api={mockApi} apiBase="/admin" />);

    expect(getByText("No roles found.")).toBeTruthy();
  });
});

describe("normalizeRoles", () => {
  it("returns a bare array unchanged", () => {
    expect(normalizeRoles(ROLES)).toEqual(ROLES);
  });

  it("unwraps a data envelope", () => {
    expect(normalizeRoles({data: ROLES})).toEqual(ROLES);
  });

  it("falls back to an empty array", () => {
    expect(normalizeRoles(undefined)).toEqual([]);
    expect(normalizeRoles({})).toEqual([]);
  });
});

describe("normalizeStatements", () => {
  it("normalizes direct and enveloped statement responses", () => {
    const statements = {todo: ["read", "update"]};
    expect(normalizeStatements({statements})).toEqual(statements);
    expect(normalizeStatements({data: {statements}})).toEqual(statements);
    expect(normalizeStatements(undefined)).toEqual({});
  });
});
