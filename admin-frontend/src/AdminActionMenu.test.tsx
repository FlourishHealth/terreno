import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {AdminActionMenu} from "./AdminActionMenu";

describe("AdminActionMenu", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("renders action menu and hides actions with allowed false", () => {
    const onRunAction = mock(() => {});
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[
          {id: "activate", label: "Activate"},
          {allowed: false, id: "hidden", label: "Hidden"},
        ]}
        onRunAction={onRunAction}
        selectedCount={2}
      />
    );

    const selects = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-menu"
    );
    expect(selects.length).toBeGreaterThan(0);
    const options = selects[0]?.props?.options as {label: string; value: string}[];
    expect(options.some((option) => option.value === "hidden")).toBe(false);
    expect(options.some((option) => option.value === "activate")).toBe(true);
  });

  it("returns null when every action is disallowed", () => {
    const {toJSON} = renderWithTheme(
      <AdminActionMenu
        actions={[{allowed: false, id: "hidden", label: "Hidden"}]}
        onRunAction={mock(() => {})}
        selectedCount={1}
      />
    );
    expect(toJSON()).toBeNull();
  });
});
