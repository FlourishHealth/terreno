// noExplicitAny: test mocks use type-erased RTK Query API doubles and UNSAFE_root traversal
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../../ui/node_modules/@testing-library/react-native";
import type {AdminApi} from "../types";

// Mock @terreno/ui so the Modal renders its children inline. The real Modal
// portal isn't mounted by the test renderer, which hides the cancel button.
mock.module("@terreno/ui", () => {
  const RN = require("react-native");
  const ReactMod = require("react");
  const Box = ({children, ...rest}: Record<string, unknown>) =>
    ReactMod.createElement(RN.View, rest, children);
  const Button = ({text, onClick, testID}: Record<string, unknown>) =>
    ReactMod.createElement(
      RN.Pressable,
      {onPress: onClick, testID},
      ReactMod.createElement(RN.Text, {}, text)
    );
  const Heading = ({children}: Record<string, unknown>) =>
    ReactMod.createElement(RN.Text, {}, children);
  const Icon = () => ReactMod.createElement(RN.View, {});
  const Modal = ({children, visible}: Record<string, unknown>) => {
    if (!visible) return null;
    return ReactMod.createElement(RN.View, {testID: "mock-modal"}, children);
  };
  const Spinner = () => ReactMod.createElement(RN.View, {testID: "spinner"});
  const Text = ({children, ...rest}: Record<string, unknown>) =>
    ReactMod.createElement(RN.Text, rest, children);
  return {Box, Button, Heading, Icon, Modal, Spinner, Text};
});

interface TaskState {
  data: {task: Record<string, unknown>} | undefined;
  error: unknown;
  isLoading: boolean;
}
interface MockState {
  task: TaskState;
  runImpl: (arg: unknown) => {unwrap: () => Promise<unknown>};
  cancelImpl: (arg: unknown) => {unwrap: () => Promise<unknown>};
}

const state: MockState = {
  cancelImpl: () => ({unwrap: () => Promise.resolve({message: "cancelled"})}),
  runImpl: () => ({unwrap: () => Promise.resolve({taskId: "task-123"})}),
  task: {data: undefined, error: null, isLoading: false},
};

const runCalls: unknown[] = [];
const cancelCalls: unknown[] = [];

// Stable function references so useEffect deps are reference-equal across
// renders (avoids re-firing the auto-start effect on every setState).
const stableRunScript = (arg: unknown): {unwrap: () => Promise<unknown>} => {
  runCalls.push(arg);
  return state.runImpl(arg);
};
const stableCancelTask = (arg: unknown): {unwrap: () => Promise<unknown>} => {
  cancelCalls.push(arg);
  return state.cancelImpl(arg);
};
const stableRunTuple = [stableRunScript, {isLoading: false}] as const;
const stableCancelTuple = [stableCancelTask, {isLoading: false}] as const;

mock.module("../useAdminScripts", () => ({
  useAdminScripts: () => ({
    useCancelScriptTaskMutation: () => stableCancelTuple,
    useGetScriptTaskQuery: () => state.task,
    useRunScriptMutation: () => stableRunTuple,
  }),
}));

import {AdminScriptRunModal} from "../AdminScriptRunModal";

const mockApi = {} as unknown as AdminApi;

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

  it("starts a wet run when the Run button is pressed", async () => {
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="test-script"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-wet-run-button"));
    });
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

  it("early-returns when scriptName is null", async () => {
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName={null}
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks();
    expect(runCalls.length).toBe(0);
  });

  it("presses the cancel button to cancel the running task", async () => {
    state.task = {
      data: {task: {status: "running"}},
      error: null,
      isLoading: false,
    };
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="cancel-me"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks();
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-cancel-button"));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(cancelCalls).toEqual(["task-123"]);
  });

  it("swallows cancel errors so UI stays responsive", async () => {
    state.cancelImpl = () => ({unwrap: () => Promise.reject(new Error("cancel failed"))});
    state.task = {
      data: {task: {status: "running"}},
      error: null,
      isLoading: false,
    };
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="cancel-fail"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks();
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-cancel-button"));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(cancelCalls).toEqual(["task-123"]);
  });

  it("handles runScript rejection with error.data.detail", async () => {
    state.runImpl = () => ({
      unwrap: () => Promise.reject({data: {detail: "Detailed failure"}}),
    });
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="failing"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks(200);
    expect(runCalls.length).toBe(1);
  });

  it("handles runScript rejection with error.data.title (no detail)", async () => {
    state.runImpl = () => ({
      unwrap: () => Promise.reject({data: {title: "Title failure"}}),
    });
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="title-only"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks(200);
    expect(runCalls.length).toBe(1);
  });

  it("handles runScript rejection with empty payload (default message path)", async () => {
    state.runImpl = () => ({
      unwrap: () => Promise.reject(new Error("network boom")),
    });
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="no-payload"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks(200);
    expect(runCalls.length).toBe(1);
  });

  it("renders results with many lines (exercises long-result branch)", async () => {
    state.task = {
      data: {
        task: {
          result: Array.from({length: 25}, (_v, i) => `line-${i}`),
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
        scriptName="long-results"
        visible={true}
      />
    );
    await waitTicks();
    expect(toJSON()).toBeDefined();
  });

  it("returns early from handleCancel when taskId is still null", async () => {
    // Never set a taskId: runImpl never resolves to set one. The Modal stays in
    // the running phase with taskId === null, so pressing cancel hits the guard.
    state.runImpl = () => ({unwrap: () => new Promise(() => {})});
    state.task = {
      data: {task: {status: "running"}},
      error: null,
      isLoading: false,
    };
    const {getByTestId} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="pending"
        visible={true}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-dry-run-button"));
    });
    await waitTicks();
    await act(async () => {
      fireEvent.press(getByTestId("admin-script-cancel-button"));
    });
    // No cancel mutation should have been called since taskId was null
    expect(cancelCalls.length).toBe(0);
  });

  it("renders without error when visible flips from true→false (reset cycle)", async () => {
    const {rerender} = renderWithTheme(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="reset-cycle"
        visible={true}
      />
    );
    await waitTicks();
    rerender(
      <AdminScriptRunModal
        api={mockApi}
        baseUrl="/admin"
        onDismiss={() => {}}
        scriptName="reset-cycle"
        visible={false}
      />
    );
  });
});
