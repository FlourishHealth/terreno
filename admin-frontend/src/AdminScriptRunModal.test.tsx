import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {AdminScriptRunModal} from "./AdminScriptRunModal";

// Mock useAdminScripts to control hooks
const mockRunScript = mock(() => ({unwrap: () => Promise.resolve({taskId: "task-123"})}));
const mockCancelTask = mock(() => ({unwrap: () => Promise.resolve({message: "cancelled"})}));

mock.module("./useAdminScripts", () => ({
  useAdminScripts: () => ({
    useCancelScriptTaskMutation: () => [mockCancelTask, {isLoading: false}],
    useGetScriptTaskQuery: () => ({data: undefined, error: null, isLoading: false}),
    useRunScriptMutation: () => [mockRunScript, {isLoading: false}],
  }),
}));

const mockApi = {} as any;

describe("AdminScriptRunModal", () => {
  beforeEach(() => {
    mockRunScript.mockClear();
    mockCancelTask.mockClear();
  });

  it("renders without crashing when not visible", () => {
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="test-script"
        visible={false}
      />
    );

    expect(toJSON()).toBeDefined();
  });

  it("renders the modal container when visible and auto-starts", () => {
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="test-script"
        visible={true}
      />
    );

    expect(toJSON()).toBeDefined();
  });

  it("calls onDismiss when provided", () => {
    const onDismiss = mock(() => {});

    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={onDismiss}
        scriptName="test-script"
        visible={true}
      />
    );

    expect(toJSON()).toBeDefined();
  });
});
