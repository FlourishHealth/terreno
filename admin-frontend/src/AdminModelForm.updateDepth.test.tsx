// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse, AdminSyncConflicts, AdminSyncDb} from "./types";

const REPRO_TITLE = "Review the sync status banner — admin window verified";

const routerBack = mock(() => {});
const routerPush = mock(() => {});
const setOptions = mock((_opts: Record<string, unknown>) => {});

let navigationInstanceCounter = 0;
const stableNavigation = {setOptions};
const unstableUseNavigation = (): {setOptions: typeof setOptions} => {
  navigationInstanceCounter += 1;
  return {setOptions};
};

mock.module("expo-router", () => ({
  router: {back: routerBack, push: routerPush},
  useNavigation: () => stableNavigation,
}));

const configState: {config: AdminConfigResponse | null; isLoading: boolean} = {
  config: null,
  isLoading: false,
};
mock.module("./useAdminConfig", () => ({
  useAdminConfig: () => ({
    config: configState.config,
    error: null,
    isLoading: configState.isLoading,
  }),
}));

const readState: {data: Record<string, unknown> | null; isLoading: boolean} = {
  data: null,
  isLoading: false,
};
mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useBulkPatchMutation: () => [
      mock(() => ({unwrap: async () => ({updated: 1})})),
      {isLoading: false},
    ],
    useCreateMutation: () => [
      mock(() => ({unwrap: async () => ({_id: "new"})})),
      {isLoading: false},
    ],
    useDeleteMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useListQuery: () => ({data: {data: [], total: 0}, isLoading: false, refetch: async () => ({})}),
    useReadQuery: () => ({
      data: readState.data,
      error: null,
      isLoading: readState.isLoading,
    }),
    useUpdateMutation: () => [
      mock(() => ({unwrap: async () => ({_id: "todo-1"})})),
      {isLoading: false},
    ],
  }),
}));

const syncDb: AdminSyncDb = {
  hydrateWindow: mock(async () => ({hydratedIds: ["todo-1"]})),
  mutate: mock(() => ({id: "todo-1", mutationId: "mutation-id"})),
  store: {
    getEntity: () => undefined,
    raw: {
      addTableListener: () => "listener",
      delListener: () => {},
    },
  },
};

import {AdminModelForm} from "./AdminModelForm";
import {AdminProvider} from "./AdminProvider";

const todoModelConfig = {
  adminBroadcast: true,
  defaultSort: "-created",
  displayName: "Todos",
  fieldOrder: ["title", "tags", "priority", "completed", "ownerId"],
  fields: {
    _id: {required: true, type: "string"},
    completed: {default: false, required: false, type: "boolean"},
    ownerId: {ref: "User", required: true, type: "objectid"},
    priority: {
      enum: ["low", "medium", "high"],
      required: false,
      type: "string",
    },
    tags: {itemType: "string", required: false, type: "array"},
    title: {required: true, type: "string"},
  },
  fieldsets: [
    {fields: ["title", "tags", "priority", "completed"], title: "Task"},
    {fields: ["ownerId"], title: "Ownership"},
  ],
  listFields: ["title", "completed"],
  name: "Todo",
  readonlyFields: ["ownerId"],
  routePath: "/admin/todos",
  syncCollection: "todos",
};

const renderTodoEditForm = (
  syncConflicts?: AdminSyncConflicts
): ReturnType<typeof renderWithTheme> =>
  renderWithTheme(
    <AdminProvider
      api={{} as unknown as AdminApi}
      apiBase="/admin"
      getAuthHeaders={() => ({})}
      syncConflicts={syncConflicts}
      syncDb={syncDb}
    >
      <AdminModelForm
        api={{} as unknown as AdminApi}
        apiBase="/admin"
        itemId="todo-1"
        mode="edit"
        modelName="Todo"
      />
    </AdminProvider>
  );

describe("AdminModelForm update-depth repro", () => {
  beforeEach(() => {
    setOptions.mockClear();
    navigationInstanceCounter = 0;
    configState.config = {
      customScreens: [],
      models: [todoModelConfig],
      scripts: [],
    };
    readState.data = {
      completed: false,
      ownerId: "user-1",
      priority: "medium",
      tags: ["sync"],
      title: "Original title",
    };
    readState.isLoading = false;
  });

  it("types the reported title without runaway setOptions under stable navigation", async () => {
    const view = renderTodoEditForm({
      conflicts: [],
      resolve: () => {},
    });
    const titleField = view.getByTestId("admin-field-title");

    await act(async () => {
      fireEvent.changeText(titleField, REPRO_TITLE);
    });

    assert.isAtMost(
      setOptions.mock.calls.length,
      30,
      `setOptions called ${setOptions.mock.calls.length} times after one changeText`
    );
    expect(titleField.props.value).toBe(REPRO_TITLE);
  });
});

describe("AdminModelForm update-depth repro (setOptions triggers parent re-render)", () => {
  let parentRerender: (() => void) | null = null;

  const setOptionsWithRerender = mock((_opts: Record<string, unknown>) => {
    parentRerender?.();
  });

  afterEach(() => {
    parentRerender = null;
    mock.module("expo-router", () => ({
      router: {back: routerBack, push: routerPush},
      useNavigation: () => stableNavigation,
    }));
  });

  beforeEach(() => {
    mock.module("expo-router", () => ({
      router: {back: routerBack, push: routerPush},
      useNavigation: () => ({setOptions: setOptionsWithRerender}),
    }));
    setOptionsWithRerender.mockClear();
    configState.config = {
      customScreens: [],
      models: [todoModelConfig],
      scripts: [],
    };
    readState.data = {
      completed: false,
      ownerId: "user-1",
      priority: "medium",
      tags: ["sync"],
      title: "Original title",
    };
    readState.isLoading = false;
  });

  it("does not recurse when navigation.setOptions forces a parent re-render on title change", async () => {
    const form = (
      <AdminProvider
        api={{} as unknown as AdminApi}
        apiBase="/admin"
        getAuthHeaders={() => ({})}
        syncConflicts={{conflicts: [], resolve: () => {}}}
        syncDb={syncDb}
      >
        <AdminModelForm
          api={{} as unknown as AdminApi}
          apiBase="/admin"
          itemId="todo-1"
          mode="edit"
          modelName="Todo"
        />
      </AdminProvider>
    );
    const view = renderWithTheme(form);

    parentRerender = () => {
      view.rerender(form);
    };

    const titleField = view.getByTestId("admin-field-title");
    await act(async () => {
      fireEvent.changeText(titleField, REPRO_TITLE);
    });

    assert.isAtMost(
      setOptionsWithRerender.mock.calls.length,
      12,
      `setOptions rerender storm: ${setOptionsWithRerender.mock.calls.length}`
    );
    expect(titleField.props.value).toBe(REPRO_TITLE);
  });
});

describe("AdminModelForm update-depth repro (unstable navigation)", () => {
  afterEach(() => {
    mock.module("expo-router", () => ({
      router: {back: routerBack, push: routerPush},
      useNavigation: () => stableNavigation,
    }));
  });

  beforeEach(() => {
    mock.module("expo-router", () => ({
      router: {back: routerBack, push: routerPush},
      useNavigation: unstableUseNavigation,
    }));
    setOptions.mockClear();
    navigationInstanceCounter = 0;
    configState.config = {
      customScreens: [],
      models: [todoModelConfig],
      scripts: [],
    };
    readState.data = {
      completed: false,
      ownerId: "user-1",
      priority: "medium",
      tags: ["sync"],
      title: "Original title",
    };
    readState.isLoading = false;
  });

  it("flags unstable navigation identity causing runaway setOptions when typing title", async () => {
    const view = renderTodoEditForm({
      conflicts: [],
      resolve: () => {},
    });
    const titleField = view.getByTestId("admin-field-title");
    const setOptionsBefore = setOptions.mock.calls.length;

    await act(async () => {
      fireEvent.changeText(titleField, REPRO_TITLE);
    });

    const setOptionsAfterOneChange = setOptions.mock.calls.length - setOptionsBefore;
    // Evidence threshold: stable navigation should be O(1) per title change; unstable loops are much higher.
    if (setOptionsAfterOneChange > 40) {
      console.warn(
        "[repro] unstable navigation setOptions storm:",
        setOptionsAfterOneChange,
        "calls"
      );
    }
    expect(titleField.props.value).toBe(REPRO_TITLE);
  });
});
