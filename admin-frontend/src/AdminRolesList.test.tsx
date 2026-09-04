// noExplicitAny: test mocks use type-erased RTK Query API doubles and dynamic mock returns
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {SelectField} from "@terreno/ui";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import {AdminRolesField} from "./AdminRolesField";
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
  data: {
    statements: {
      admin: ["access", "runScripts"],
      adminTodo: ["read", "write", "writeOwned"],
      todo: ["read", "update"],
    },
  },
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

interface RenderedNode {
  props?: {testID?: unknown};
  children?: unknown[];
}

const collectTestIDs = (node: unknown): string[] => {
  const rendered = node as RenderedNode | null;
  const own = typeof rendered?.props?.testID === "string" ? [rendered.props.testID] : [];
  const children = Array.isArray(rendered?.children) ? rendered.children : [];
  return [...own, ...children.flatMap((child) => collectTestIDs(child))];
};

const ROLES = [
  {displayName: "Super Admin", isLocked: true, isSealed: true, name: "superadmin"},
  {
    description: "Baseline role for signed-up users",
    displayName: "Todo User",
    name: "todoUser",
    permissions: {adminTodo: ["read", "writeOwned"]},
  },
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

  it("edits standard model access with a single access-level selector", async () => {
    mockUseListRolesQuery.mockReturnValue({
      data: ROLES,
      error: null,
      isLoading: false,
      refetch: mockRefetch,
    });
    const {getByTestId, UNSAFE_root} = renderWithTheme(
      <AdminRolesList api={mockApi} apiBase="/admin" />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-roles-edit-todoUser"));
    });
    const accessSelect = UNSAFE_root.findAllByType(SelectField).find(
      (field) => field.props.testID === "admin-role-access-adminTodo"
    );
    assert.equal(accessSelect?.props.value, "writeOwned");

    await act(async () => {
      accessSelect?.props.onChange("write");
    });
    await act(async () => {
      fireEvent.press(getByTestId("admin-role-save-button"));
    });

    const updateInput = mockUpdateRole.mock.calls[0]?.[0] as {
      changes?: {permissions?: Record<string, string[]>};
      roleName?: string;
    };
    assert.equal(updateInput.roleName, "todoUser");
    assert.deepEqual(updateInput.changes?.permissions, {adminTodo: ["read", "write"]});
  });

  it("edits admin page access with a dedicated toggle", async () => {
    mockUseListRolesQuery.mockReturnValue({
      data: ROLES,
      error: null,
      isLoading: false,
      refetch: mockRefetch,
    });
    const {getByTestId, getByText} = renderWithTheme(
      <AdminRolesList api={mockApi} apiBase="/admin" />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-roles-edit-todoUser"));
    });

    expect(getByTestId("admin-role-page-access")).toBeTruthy();
    expect(getByText("Allow access to the admin page")).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId("admin-role-permission-admin-access-clickable"));
    });
    await act(async () => {
      fireEvent.press(getByTestId("admin-role-save-button"));
    });

    const updateInput = mockUpdateRole.mock.calls[0]?.[0] as {
      changes?: {permissions?: Record<string, string[]>};
      roleName?: string;
    };
    assert.equal(updateInput.roleName, "todoUser");
    assert.deepEqual(updateInput.changes?.permissions, {
      admin: ["access"],
      adminTodo: ["read", "writeOwned"],
    });
  });

  it("scrolls the role list body while keeping the add button outside the scroll area", () => {
    mockUseListRolesQuery.mockReturnValue({
      data: ROLES,
      error: null,
      isLoading: false,
      refetch: mockRefetch,
    });
    const {getByTestId} = renderWithTheme(<AdminRolesList api={mockApi} apiBase="/admin" />);

    const scrollArea = getByTestId("admin-roles-scroll");
    expect(scrollArea).toBeTruthy();

    const scrollTestIDs = collectTestIDs(scrollArea);
    expect(scrollTestIDs).toContain("admin-roles-item-superadmin");
    expect(scrollTestIDs).toContain("admin-permissions-list");
    expect(scrollTestIDs).not.toContain("admin-roles-add-button");
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

describe("AdminRolesField", () => {
  const fieldConfig = {
    description: "Roles assigned to this user",
    itemType: "string",
    required: false,
    type: "array",
  };

  beforeEach(() => {
    mockUseListRolesQuery.mockReturnValue({
      data: [
        {displayName: "Admin", name: "admin"},
        {displayName: "Manager", name: "manager"},
        {displayName: "Member", name: "member"},
      ],
      error: null,
      isLoading: false,
    });
  });

  it("offers unassigned existing roles in an Add role dropdown", () => {
    const onChange = mock((_value: unknown) => undefined);
    const {getByTestId, UNSAFE_root} = renderWithTheme(
      <AdminRolesField
        api={mockApi}
        apiBase="/admin"
        fieldConfig={fieldConfig}
        fieldKey="roles"
        onChange={onChange}
        value={["member"]}
      />
    );

    expect(getByTestId("admin-field-roles-selected-member")).toBeTruthy();
    const roleSelect = UNSAFE_root.findByType(SelectField);
    expect(roleSelect.props.title).toBe("Add role");
    expect(roleSelect.props.options).toEqual([
      {label: "Admin", value: "admin"},
      {label: "Manager", value: "manager"},
    ]);

    act(() => {
      roleSelect.props.onChange("manager");
    });
    expect(onChange).toHaveBeenCalledWith(["member", "manager"]);
  });

  it("removes an assigned role without changing other assignments", async () => {
    const onChange = mock((_value: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AdminRolesField
        api={mockApi}
        apiBase="/admin"
        fieldConfig={fieldConfig}
        fieldKey="roles"
        onChange={onChange}
        value={["admin", "member"]}
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-field-roles-remove-admin"));
    });

    expect(onChange).toHaveBeenCalledWith(["member"]);
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
