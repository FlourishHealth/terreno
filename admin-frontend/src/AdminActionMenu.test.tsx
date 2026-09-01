import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {renderWithTheme} from "../../ui/src/test-utils";
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

  it("keeps the confirm modal open when onRunAction rejects", async () => {
    const onRunAction = mock(() => Promise.reject(new Error("failed")));
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[{confirm: "Really activate?", id: "activate", label: "Activate"}]}
        onRunAction={onRunAction}
        selectedCount={2}
      />
    );

    const selects = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-menu"
    );
    const select = selects[0];
    expect(select).toBeDefined();
    await act(async () => {
      select?.props?.onChange("activate");
    });

    const confirm = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-activate"
    );
    expect(confirm[0]?.props?.visible).toBe(true);
    await act(async () => {
      await confirm[0]?.props?.primaryButtonOnClick();
    });
    expect(onRunAction).toHaveBeenCalled();
    const after = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-activate"
    );
    expect(after[0]?.props?.visible).toBe(true);
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

  it("runs an immediate action and ignores empty or unknown selections", async () => {
    const onRunAction = mock(() => Promise.resolve());
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[{id: "activate", label: "Activate"}]}
        onRunAction={onRunAction}
        selectedCount={1}
      />
    );
    const select = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-menu"
    )[0];

    await act(async () => {
      select.props.onChange("__none__");
      select.props.onChange("missing");
      select.props.onChange("activate");
      await Promise.resolve();
    });
    expect(onRunAction).toHaveBeenCalledTimes(1);
    expect(onRunAction).toHaveBeenCalledWith("activate");
  });

  it("closes a confirmation after success and supports cancel and dismiss", async () => {
    const onRunAction = mock(() => Promise.resolve());
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[{confirm: "Continue?", id: "activate", label: "Activate"}]}
        onRunAction={onRunAction}
        selectedCount={1}
      />
    );
    const select = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-menu"
    )[0];
    await act(async () => {
      select.props.onChange("activate");
    });
    let modal = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-activate"
    )[0];
    await act(async () => {
      await modal.props.primaryButtonOnClick();
    });
    expect(onRunAction).toHaveBeenCalledWith("activate");
    expect(
      UNSAFE_root.findAll(
        (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-activate"
      )
    ).toHaveLength(0);

    await act(async () => {
      select.props.onChange("activate");
    });
    modal = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-activate"
    )[0];
    await act(async () => {
      modal.props.secondaryButtonOnClick();
      modal.props.onDismiss();
    });
    expect(onRunAction).toHaveBeenCalledTimes(1);
  });
});
