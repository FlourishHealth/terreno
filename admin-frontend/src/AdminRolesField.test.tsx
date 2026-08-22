import {describe, expect, it, mock} from "bun:test";
import {SelectField} from "@terreno/ui";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {AdminRolesField} from "./AdminRolesField";
import type {AdminApi} from "./types";

const mockUseListRolesQuery = mock(() => ({
  data: [
    {displayName: "Admin", name: "admin"},
    {displayName: "Manager", name: "manager"},
    {displayName: "Member", name: "member"},
  ],
  error: null,
  isLoading: false,
}));

const api = {
  injectEndpoints: () => ({
    useAdminListRbacRolesQuery: mockUseListRolesQuery,
  }),
} as unknown as AdminApi;

const fieldConfig = {
  description: "Roles assigned to this user",
  itemType: "string",
  required: false,
  type: "array",
};

describe("AdminRolesField", () => {
  it("offers unassigned existing roles in an Add role dropdown", () => {
    const onChange = mock((_value: unknown) => undefined);
    const {getByTestId, UNSAFE_root} = renderWithTheme(
      <AdminRolesField
        api={api}
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
        api={api}
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
