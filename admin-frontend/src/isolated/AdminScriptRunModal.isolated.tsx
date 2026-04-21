import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act} from "../../../ui/node_modules/@testing-library/react-native";

interface TaskState {
  data: {task: any} | undefined;
  error: any;
  isLoading: boolean;
}
interface MockState {
  task: TaskState;
  runImpl: (arg: any) => {unwrap: () => Promise<any>};
  cancelImpl: (arg: any) => {unwrap: () => Promise<any>};
}

const state: MockState = {
  cancelImpl: () => ({unwrap: () => Promise.resolve({message: "cancelled"})}),
  runImpl: () => ({unwrap: () => Promise.resolve({taskId: "task-123"})}),
  task: {data: undefined, error: null, isLoading: false},
};

const runCalls: any[] = [];
const cancelCalls: any[] = [];

mock.module("../useAdminScripts", () => ({
  useAdminScripts: () => ({
    useCancelScriptTaskMutation: () => [
      (arg: any) => {
        cancelCalls.push(arg);
        return state.cancelImpl(arg);
      },
      {isLoading: false},
    ],
    useGetScriptTaskQuery: () => state.task,
    useRunScriptMutation: () => [
      (arg: any) => {
        runCalls.push(arg);
        return state.runImpl(arg);
      },
      {isLoading: false},
    ],
  }),
}));

import {AdminScriptRunModal} from "../AdminScriptRunModal";

const mockApi = {} as any;

const waitTicks = async (ms = 40): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

describe("AdminScriptRunModal", () => {
  beforeEach(() => {
    runCalls.length = 0;
    cancelCalls.length = 0;
    state.task = {data: undefined, error: null, isLoading: false};
    state.runImpl = () => ({unwrap: () => Promise.resolve({taskId: "task-123"})});
    state.cancelImpl = () => ({unwrap: () => Promise.resolve({message: "cancelled"})});
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
    expect(runCalls.length).toBe(0);
  });

  it("auto-starts script when modal opens", async () => {
    renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="test-script"
        visible={true}
      />
    );
    await waitTicks();
    expect(runCalls.length).toBe(1);
    expect(runCalls[0]).toEqual({name: "test-script", wetRun: true});
  });

  it("renders running phase with progress details", async () => {
    state.task = {
      data: {
        task: {
          progress: {message: "Working", percentage: 42, stage: "processing"},
          status: "running",
        },
      },
      error: null,
      isLoading: false,
    };
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="my-script"
        visible={true}
      />
    );
    await waitTicks();
    expect(toJSON()).toBeDefined();
  });

  it("renders running phase with zero percentage omitted", async () => {
    state.task = {
      data: {task: {progress: {percentage: 0}, status: "running"}},
      error: null,
      isLoading: false,
    };
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="zero-pct"
        visible={true}
      />
    );
    await waitTicks();
    expect(toJSON()).toBeDefined();
  });

  it("renders completed status with results", async () => {
    state.task = {
      data: {
        task: {
          result: ["line1", "line2", "line3"],
          status: "completed",
        },
      },
      error: null,
      isLoading: false,
    };
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="done-script"
        visible={true}
      />
    );
    await waitTicks();
    expect(toJSON()).toBeDefined();
  });

  it("renders failed status with error message", async () => {
    state.task = {
      data: {
        task: {error: "Failed to process", status: "failed"},
      },
      error: null,
      isLoading: false,
    };
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="fail-script"
        visible={true}
      />
    );
    await waitTicks();
    expect(toJSON()).toBeDefined();
  });

  it("renders cancelled status", async () => {
    state.task = {
      data: {task: {status: "cancelled"}},
      error: null,
      isLoading: false,
    };
    const {toJSON} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="cancelled-script"
        visible={true}
      />
    );
    await waitTicks();
    expect(toJSON()).toBeDefined();
  });

  it("early-returns when scriptName is null", () => {
    renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName={null}
        visible={true}
      />
    );
    expect(runCalls.length).toBe(0);
  });
});
