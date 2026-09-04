import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";

mock.module("expo-router", () => ({
  router: {push: () => {}},
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
    const {getByHintText} = renderWithTheme(
      <AdminBreadcrumbs segments={[{href: "/", label: "Admin"}, {label: "Todos"}]} />
    );
    expect(getByHintText("Navigate to Admin")).toBeTruthy();
  });
});
