import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";

mock.module("expo-router", () => ({
  router: {push: () => undefined},
}));

import {AdminBreadcrumbs} from "./AdminBreadcrumbs";

describe("AdminBreadcrumbs", () => {
  it("renders labels and separators", () => {
    const {getByText, getByTestId} = renderWithTheme(
      <AdminBreadcrumbs segments={[{href: "/", label: "Admin"}, {label: "Todos"}]} />
    );
    expect(getByText("Admin")).toBeTruthy();
    expect(getByText("Todos")).toBeTruthy();
    expect(getByTestId("admin-breadcrumb-sep-1")).toBeTruthy();
  });

  it("exposes an accessible control for linked segments", () => {
    const {getByHintText, getByTestId} = renderWithTheme(
      <AdminBreadcrumbs segments={[{href: "/", label: "Admin"}, {label: "Todos"}]} />
    );
    expect(getByHintText("Navigate to Admin")).toBeTruthy();
    act(() => {
      fireEvent.press(getByTestId("admin-breadcrumb-link-0-clickable"));
    });
  });
});
