// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import * as terrenoUi from "@terreno/ui";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
import {AdminScriptRunModal} from "./AdminScriptRunModal";

// Render Modal children inline so we can interact with them in tests
mock.module("@terreno/ui", () => ({
  ...terrenoUi,
  Modal: ({children, visible}: {children?: React.ReactNode; visible?: boolean}) =>
    visible ? children : null,
}));

const mockRunScript = mock((_args: {name: string; wetRun: boolean}) => ({
  unwrap: async () => ({taskId: "task-123"}),
}));
const mockCancelTask = mock((_taskId: string) => ({
  unwrap: async () => ({}),
}));

const mockUseAdminScripts = mock(() => ({
  useCancelScriptTaskMutation: () => [mockCancelTask, {isLoading: false}],
  useGetScriptTaskQuery: () => ({data: undefined, error: null, isLoading: false}),
  useRunScriptMutation: () => [mockRunScript, {isLoading: false}],
}));

mock.module("./useAdminScripts", () => ({
  useAdminScripts: (...args: any[]) => mockUseAdminScripts(...args),
}));

const mockApi = {} as any;

describe("AdminScriptRunModal", () => {
  beforeEach(() => {
    mockRunScript.mockClear();
    mockCancelTask.mockClear();
    mockUseAdminScripts.mockClear();
  });

  it("renders Dry Run, Run, and Cancel buttons in confirm phase", () => {
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => undefined}
        scriptName="my-script"
        visible
      />
    );

    expect(getByTestId("admin-script-dry-run-button")).toBeTruthy();
    expect(getByTestId("admin-script-wet-run-button")).toBeTruthy();
    expect(getByTestId("admin-script-confirm-cancel-button")).toBeTruthy();
  });

  it("calls onDismiss when Cancel is pressed without invoking runScript", async () => {
    const onDismiss = mock(() => undefined);

    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={onDismiss}
        scriptName="my-script"
        visible
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-script-confirm-cancel-button"));
    });

    expect(onDismiss).toHaveBeenCalled();
    expect(mockRunScript).not.toHaveBeenCalled();
  });

  it("dispatches a dry run when the Dry Run button is pressed", async () => {
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => undefined}
        scriptName="my-script"
        visible
      />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });

    expect(mockRunScript).toHaveBeenCalledTimes(1);
    expect(mockRunScript.mock.calls[0]?.[0]).toEqual({name: "my-script", wetRun: false});
  });

  it("hides the wet-run button when dryRunOnly is true", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        dryRunOnly
        onDismiss={() => undefined}
        scriptName="my-script"
        visible
      />
    );

    expect(getByTestId("admin-script-dry-run-button")).toBeTruthy();
    expect(getByTestId("admin-script-confirm-cancel-button")).toBeTruthy();
    expect(queryByTestId("admin-script-wet-run-button")).toBeNull();
  });

  it("renders the script description in the confirm phase", () => {
    const {getByText} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => undefined}
        scriptDescription="Migrates legacy records"
        scriptName="migrate-data"
        visible
      />
    );

    expect(getByText("Migrates legacy records")).toBeTruthy();
    expect(getByText("migrate-data")).toBeTruthy();
  });
});
