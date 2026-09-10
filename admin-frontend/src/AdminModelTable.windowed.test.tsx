// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse, AdminSyncDb} from "./types";

const setOptions = mock((_: unknown) => {});
mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
  useNavigation: () => ({setOptions}),
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

const listState: {data: {data: Array<Record<string, unknown>>; total: number}} = {
  data: {data: [], total: 0},
};
const listRefetch = mock(async () => ({data: listState.data}));
mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useBulkPatchMutation: () => [
      mock(() => ({unwrap: async () => ({updated: 1})})),
      {isLoading: false},
    ],
    useCreateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useDeleteMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useListQuery: () => ({
      data: listState.data,
      error: null,
      isLoading: false,
      refetch: listRefetch,
    }),
    useReadQuery: () => ({data: null, error: null, isLoading: false}),
    useUpdateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
  }),
}));

mock.module("./useAdminBackgroundTask", () => ({
  useAdminBackgroundTaskMutation: () => [
    mock(() => ({unwrap: async () => ({taskId: "t1"})})),
    {isLoading: false},
  ],
}));

import {AdminModelTable} from "./AdminModelTable";
import {AdminProvider} from "./AdminProvider";

const windowedConfig: AdminConfigResponse = {
  customScreens: [],
  models: [
    {
      adminBroadcast: true,
      defaultSort: "-created",
      displayName: "Todos",
      fields: {
        _id: {required: true, type: "string"},
        title: {required: true, type: "string"},
      },
      listFields: ["title"],
      name: "Todo",
      routePath: "/admin/todos",
      syncCollection: "todos",
    },
  ],
  scripts: [],
};

const collectTitleTexts = (root: ReactTestInstance): string[] => {
  const tables = root.findAll(
    (node: ReactTestInstance) =>
      Array.isArray(node.props?.data) && Array.isArray(node.props?.columns)
  );
  assert.isAbove(tables.length, 0);
  const rows = tables[0].props.data as Array<Array<{value: unknown}>>;
  return rows.map((row) => {
    const link = row.find((cell) => {
      const value = cell.value as {text?: string} | undefined;
      return Boolean(value && typeof value === "object" && typeof value.text === "string");
    });
    return String((link?.value as {text?: string} | undefined)?.text ?? "");
  });
};

const createFakeSyncDb = (): {
  extraStore: Map<string, {data: unknown; deleted?: boolean; id: string}>;
  hydrateWindow: ReturnType<typeof mock>;
  syncDb: AdminSyncDb;
} => {
  const extraStore = new Map<string, {data: unknown; deleted?: boolean; id: string}>();
  const hydrateWindow = mock(async (args: {ids: string[]; restRows?: Record<string, unknown>}) => {
    for (const id of args.ids) {
      const rest = args.restRows?.[id];
      if (rest !== undefined) {
        extraStore.set(id, {data: rest, id});
      }
    }
    return {hydratedIds: args.ids};
  });
  return {
    extraStore,
    hydrateWindow,
    syncDb: {
      hydrateWindow,
      store: {
        getEntity: ({id}: {id: string}) => extraStore.get(id),
      },
    },
  };
};

const renderWindowed = (syncDb: AdminSyncDb): ReturnType<typeof renderWithTheme> => {
  return renderWithTheme(
    <AdminProvider
      api={{} as unknown as AdminApi}
      apiBase="/admin"
      getAuthHeaders={() => ({})}
      routeBase="/admin"
      syncDb={syncDb}
    >
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="Todo" />
    </AdminProvider>
  );
};

describe("AdminModelTable windowed path", () => {
  beforeEach(() => {
    setOptions.mockClear();
    listRefetch.mockClear();
    configState.config = windowedConfig;
    listState.data = {data: [], total: 0};
    listRefetch.mockImplementation(async () => ({data: listState.data}));
  });

  it("renders REST membership page ids and hydrates them", async () => {
    const {hydrateWindow, syncDb} = createFakeSyncDb();
    listState.data = {
      data: [
        {_id: "todo-1", title: "Alpha"},
        {_id: "todo-2", title: "Beta"},
      ],
      total: 2,
    };
    const {UNSAFE_root} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha", "Beta"]);
    assert.isTrue(hydrateWindow.mock.calls.length > 0);
    const firstCall = hydrateWindow.mock.calls[0]?.[0] as {ids: string[]};
    assert.deepEqual(firstCall.ids, ["todo-1", "todo-2"]);
  });

  it("does not render a TinyBase id that is outside REST membership", async () => {
    const {extraStore, syncDb} = createFakeSyncDb();
    extraStore.set("ghost", {data: {_id: "ghost", title: "Ghost row"}, id: "ghost"});
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    const {UNSAFE_root, queryByTestId} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha"]);
    assert.isNotNull(queryByTestId("admin-table-refresh"));
  });

  it("Refresh re-queries membership and then shows the new id", async () => {
    const {syncDb} = createFakeSyncDb();
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    listRefetch.mockImplementation(async () => {
      listState.data = {
        data: [
          {_id: "todo-1", title: "Alpha"},
          {_id: "todo-2", title: "From refresh"},
        ],
        total: 2,
      };
      return {data: listState.data};
    });
    const {UNSAFE_root, getByTestId} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha"]);
    await act(async () => {
      fireEvent.press(getByTestId("admin-table-refresh"));
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha", "From refresh"]);
  });

  it("surfaces a Refresh failure without throwing", async () => {
    const {syncDb} = createFakeSyncDb();
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    listRefetch.mockImplementation(async () => {
      throw new Error("network down");
    });
    const {getByTestId} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(getByTestId("admin-table-refresh"));
      await Promise.resolve();
    });
    assert.isTrue(listRefetch.mock.calls.length > 0);
  });

  it("treats an RTK refetch error envelope as a Refresh failure", async () => {
    const {hydrateWindow, syncDb} = createFakeSyncDb();
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    listRefetch.mockImplementation(async () => ({
      error: {data: "nope", status: 500},
      isError: true,
    }));
    const {UNSAFE_root, getByTestId} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    const hydrateCountAfterMount = hydrateWindow.mock.calls.length;
    await act(async () => {
      fireEvent.press(getByTestId("admin-table-refresh"));
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha"]);
    assert.equal(hydrateWindow.mock.calls.length, hydrateCountAfterMount);
  });

  it("does not throw when window hydrate rejects", async () => {
    const {hydrateWindow, syncDb} = createFakeSyncDb();
    hydrateWindow.mockImplementation(async () => {
      throw new Error("tinybase down");
    });
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    const {UNSAFE_root} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha"]);
  });

  it("drops a stale Refresh after the table unmounts", async () => {
    const {hydrateWindow, syncDb} = createFakeSyncDb();
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    let resolveRefetch: ((value: {data: typeof listState.data}) => void) | undefined;
    listRefetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefetch = resolve;
        })
    );
    const {getByTestId, unmount} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    const hydrateCountAfterMount = hydrateWindow.mock.calls.length;
    await act(async () => {
      fireEvent.press(getByTestId("admin-table-refresh"));
    });
    unmount();
    await act(async () => {
      resolveRefetch?.({
        data: {
          data: [{_id: "stale", title: "Stale refresh"}],
          total: 1,
        },
      });
      await Promise.resolve();
    });
    const refreshHydrates = hydrateWindow.mock.calls.slice(hydrateCountAfterMount);
    for (const call of refreshHydrates) {
      const args = call[0] as {ids: string[]};
      assert.notInclude(args.ids, "stale");
    }
  });

  it("skips membership rows without ids and Refresh without a new envelope", async () => {
    const {hydrateWindow, syncDb} = createFakeSyncDb();
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}, {title: "orphan"}],
      total: 1,
    };
    listRefetch.mockImplementation(async () => ({}));
    const {UNSAFE_root, getByTestId} = renderWindowed(syncDb);
    await act(async () => {
      await Promise.resolve();
    });
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha"]);
    await act(async () => {
      fireEvent.press(getByTestId("admin-table-refresh"));
      await Promise.resolve();
    });
    const lastCall = hydrateWindow.mock.calls[hydrateWindow.mock.calls.length - 1]?.[0] as {
      ids: string[];
    };
    assert.deepEqual(lastCall.ids, ["todo-1"]);
  });

  it("keeps the RTK path when only api is provided", () => {
    configState.config = windowedConfig;
    listState.data = {
      data: [{_id: "todo-1", title: "Alpha"}],
      total: 1,
    };
    const {queryByTestId, UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="Todo" />
    );
    assert.isNull(queryByTestId("admin-table-refresh"));
    assert.deepEqual(collectTitleTexts(UNSAFE_root), ["Alpha"]);
  });
});
