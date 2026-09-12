import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {renderWithTheme} from "../../ui/src/test-utils";
import {AdminActionMenu} from "./AdminActionMenu";

const findSelect = (root: {
  findAll: (fn: (node: ReactTestInstance) => boolean) => ReactTestInstance[];
}): ReactTestInstance | undefined =>
  root.findAll((node: ReactTestInstance) => node.props?.testID === "admin-action-menu")[0];

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

  it("runs actions without confirmation even when onRunAction rejects", async () => {
    const onRunAction = mock(() => Promise.reject(new Error("network")));
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[{id: "archive", label: "Archive"}]}
        onRunAction={onRunAction}
        selectedCount={3}
      />
    );

    const select = findSelect(UNSAFE_root);
    await act(async () => {
      select?.props?.onChange("archive");
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onRunAction).toHaveBeenCalledWith("archive");
    assert.equal(select?.props?.value, "__none__");
  });

  it("closes the confirm modal after a successful bulk action", async () => {
    const onRunAction = mock(async () => undefined);
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[{confirm: "Archive selected rows?", id: "archive", label: "Archive"}]}
        onRunAction={onRunAction}
        selectedCount={2}
      />
    );

    const select = findSelect(UNSAFE_root);
    await act(async () => {
      select?.props?.onChange("archive");
    });
    const confirm = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-archive"
    )[0];
    assert.isTrue(confirm?.props?.visible);

    await act(async () => {
      await confirm?.props?.primaryButtonOnClick();
    });
    expect(onRunAction).toHaveBeenCalledWith("archive");
    const openConfirms = UNSAFE_root.findAll(
      (node: ReactTestInstance) =>
        node.props?.testID === "admin-action-confirm-archive" && node.props?.visible === true
    );
    assert.equal(openConfirms.length, 0);
  });

  it("disables the menu when nothing is selected or the parent disables it", () => {
    const disabled = renderWithTheme(
      <AdminActionMenu
        actions={[{id: "archive", label: "Archive"}]}
        disabled
        onRunAction={mock(() => {})}
        selectedCount={4}
      />
    );
    assert.isTrue(findSelect(disabled.UNSAFE_root)?.props?.disabled);

    const emptySelection = renderWithTheme(
      <AdminActionMenu
        actions={[{id: "archive", label: "Archive"}]}
        onRunAction={mock(() => {})}
        selectedCount={0}
      />
    );
    assert.isTrue(findSelect(emptySelection.UNSAFE_root)?.props?.disabled);
  });

  it("dismisses the confirm modal from cancel without running the action", async () => {
    const onRunAction = mock(async () => undefined);
    const {UNSAFE_root} = renderWithTheme(
      <AdminActionMenu
        actions={[{confirm: "Delete selected rows?", id: "delete", label: "Delete"}]}
        onRunAction={onRunAction}
        selectedCount={1}
      />
    );

    const select = findSelect(UNSAFE_root);
    await act(async () => {
      select?.props?.onChange("delete");
    });
    const confirm = UNSAFE_root.findAll(
      (node: ReactTestInstance) => node.props?.testID === "admin-action-confirm-delete"
    )[0];
    await act(async () => {
      confirm?.props?.secondaryButtonOnClick?.();
    });
    expect(onRunAction).not.toHaveBeenCalled();
    const openConfirms = UNSAFE_root.findAll(
      (node: ReactTestInstance) =>
        node.props?.testID === "admin-action-confirm-delete" && node.props?.visible === true
    );
    assert.equal(openConfirms.length, 0);
  });
});
