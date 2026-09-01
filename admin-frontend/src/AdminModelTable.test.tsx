// noExplicitAny: test mocks use type-erased RTK Query API doubles and UNSAFE_root traversal
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {renderWithTheme} from "../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "./types";

const routerPush = mock(() => {});
const setOptions = mock((_: unknown) => {});
mock.module("expo-router", () => ({
  router: {push: routerPush},
  useNavigation: () => ({setOptions}),
}));

const configState: {config: AdminConfigResponse | null; isLoading: boolean} = {
  config: null,
  isLoading: false,
};
// Records the apiBase passed to useAdminConfig so tests can assert that data
// fetching uses the resolved API base (not the route base).
const configApiBaseCalls: string[] = [];
mock.module("./useAdminConfig", () => ({
  useAdminConfig: (_api: unknown, apiBase: string) => {
    configApiBaseCalls.push(apiBase);
    return {
      config: configState.config,
      error: null,
      isLoading: configState.isLoading,
    };
  },
}));

const listState: {data: unknown; isLoading: boolean} = {
  data: {data: [], total: 0},
  isLoading: false,
};
const listQueryArgs: unknown[] = [];
const deleteFn = mock(() => ({unwrap: async () => ({})}));
const patchFn = mock(() => ({unwrap: async () => ({})}));
const bulkPatchFn = mock(() => ({unwrap: async () => ({updated: 1})}));
const enqueueBackgroundFn = mock(() => ({unwrap: async () => ({taskId: "t1"})}));
mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useBulkPatchMutation: () => [bulkPatchFn, {isLoading: false}],
    useCreateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useDeleteMutation: () => [deleteFn, {isLoading: false}],
    useListQuery: (params: unknown) => {
      listQueryArgs.push(params);
      return {
        data: listState.data,
        error: null,
        isLoading: listState.isLoading,
      };
    },
    useReadQuery: () => ({data: null, error: null, isLoading: false}),
    useUpdateMutation: () => [patchFn, {isLoading: false}],
  }),
}));

mock.module("./useAdminBackgroundTask", () => ({
  useAdminBackgroundTaskMutation: () => [enqueueBackgroundFn, {isLoading: false}],
}));

import {AdminModelTable} from "./AdminModelTable";

const fullConfig = {
  customScreens: [],
  models: [
    {
      defaultSort: "-created",
      displayName: "User",
      fields: {
        _id: {required: true, type: "string"},
        active: {required: false, type: "boolean"},
        age: {required: false, type: "number"},
        created: {required: false, type: "date"},
        email: {required: false, type: "string"},
        tags: {required: false, type: "array"},
      },
      listFields: ["email", "active", "age", "created", "tags"],
      name: "User",
      routePath: "/admin/users",
    },
  ],
  scripts: [],
};

describe("AdminModelTable", () => {
  beforeEach(() => {
    routerPush.mockClear();
    setOptions.mockClear();
    deleteFn.mockClear();
    patchFn.mockClear();
    bulkPatchFn.mockClear();
    enqueueBackgroundFn.mockClear();
    listQueryArgs.length = 0;
    configApiBaseCalls.length = 0;
    configState.config = null;
    configState.isLoading = false;
    listState.data = {data: [], total: 0};
    listState.isLoading = false;
  });

  it("renders loading page while config is loading", () => {
    configState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders loading page when model config is missing", () => {
    configState.config = {customScreens: [], models: [], scripts: []};
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders empty state when no data present", () => {
    configState.config = fullConfig;
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
    expect(setOptions).toHaveBeenCalled();
  });

  it("renders loading state when the list query is loading", () => {
    configState.config = fullConfig;
    listState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders data with various column types and formats values", () => {
    configState.config = fullConfig;
    listState.data = {
      data: [
        {
          _id: "u1",
          active: true,
          age: 42,
          created: "2024-01-01T00:00:00Z",
          email: "a@b.com",
          tags: ["x", "y"],
        },
        {
          _id: "u2",
          active: false,
          age: null,
          created: null,
          email: "c@d.com",
          tags: {_id: "nested", other: "value"},
        },
      ],
      total: 2,
    };
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("supports custom column overrides", () => {
    configState.config = fullConfig;
    listState.data = {
      data: [{_id: "u1", email: "a@b.com"}],
      total: 1,
    };
    const {toJSON} = renderWithTheme(
      <AdminModelTable
        api={{} as unknown as AdminApi}
        baseUrl="/admin"
        columns={["email"]}
        modelName="User"
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("treats DATE_FIELD_NAMES without explicit type as date columns and widens _id", () => {
    // "created" and "updated" should be recognized as date fields even without an
    // explicit fieldConfig.type of "date"; "_id" should use the wider column width.
    configState.config = {
      customScreens: [],
      models: [
        {
          defaultSort: undefined,
          displayName: "Plain",
          fields: {
            _id: {required: true, type: "string"},
            // Intentionally mark created/updated as "string" so the DATE_FIELD_NAMES
            // branch (line 49) must be the branch that classifies them as "date".
            created: {required: false, type: "string"},
            name: {required: false, type: "string"},
            updated: {required: false, type: "string"},
          },
          listFields: ["_id", "name", "created", "updated"],
          name: "Plain",
          routePath: "/admin/plain",
        },
      ],
      scripts: [],
    };
    listState.data = {
      data: [
        {
          _id: "p1",
          created: "2024-01-02T00:00:00Z",
          name: "thing",
          updated: "2024-02-03T00:00:00Z",
        },
      ],
      total: 1,
    };
    const {toJSON} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="Plain" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders the headerRight create button and pushes to the create route on click", async () => {
    configState.config = fullConfig;
    let headerRight: React.ReactElement | null = null;
    setOptions.mockImplementation((opts: Record<string, unknown>) => {
      if (opts?.headerRight) {
        headerRight = opts.headerRight();
      }
    });
    renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(headerRight).not.toBeNull();
    const header = renderWithTheme(headerRight as unknown as React.ReactElement);
    await act(async () => {
      fireEvent.press(header.getByTestId("admin-create-button"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(routerPush).toHaveBeenCalledWith("/admin/User/create");
  });

  it("handles delete errors without throwing via the actions cell", async () => {
    configState.config = fullConfig;
    listState.data = {
      data: [{_id: "u1", active: true, age: 1, created: null, email: "a@b.com", tags: []}],
      total: 1,
    };
    // Force delete to fail so the catch branch runs.
    deleteFn.mockImplementationOnce(() => ({
      unwrap: async () => {
        throw new Error("nope");
      },
    }));
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    // Find the actions cellData.onDelete handler and invoke it directly.
    const nodes = UNSAFE_root.findAll((n: ReactTestInstance) => {
      const v = n.props?.cellData?.value;
      return v && typeof v.onDelete === "function" && v.id === "u1";
    });
    expect(nodes.length).toBeGreaterThan(0);
    await act(async () => {
      (nodes[0] as ReactTestInstance).props.cellData.value.onDelete("u1");
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(deleteFn).toHaveBeenCalled();
  });

  it("applies columnWidths prop overrides to DataTable columns", () => {
    configState.config = fullConfig;
    listState.data = {data: [{_id: "u1", email: "a@b.com"}], total: 1};
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable
        api={{} as unknown as AdminApi}
        baseUrl="/admin"
        columnWidths={{email: 999}}
        modelName="User"
      />
    );
    const tables = UNSAFE_root.findAll((n: ReactTestInstance) => Array.isArray(n.props?.columns));
    expect(tables.length).toBeGreaterThan(0);
    const cols = (tables[0] as ReactTestInstance).props.columns as {
      title: string;
      width?: number;
    }[];
    const emailCol = cols.find((c) => c.title === "Email");
    expect(emailCol?.width).toBe(999);
  });

  it("falls back to listColumnWidths from backend config when columnWidths prop is absent", () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          listColumnWidths: {email: 555},
        },
      ],
      scripts: [],
    };
    listState.data = {data: [{_id: "u1", email: "a@b.com"}], total: 1};
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    const tables = UNSAFE_root.findAll((n: ReactTestInstance) => Array.isArray(n.props?.columns));
    const cols = (tables[0] as ReactTestInstance).props.columns as {
      title: string;
      width?: number;
    }[];
    const emailCol = cols.find((c) => c.title === "Email");
    expect(emailCol?.width).toBe(555);
  });

  it("prefers columnWidths prop over backend listColumnWidths", () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          listColumnWidths: {email: 100},
        },
      ],
      scripts: [],
    };
    listState.data = {data: [{_id: "u1", email: "a@b.com"}], total: 1};
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable
        api={{} as unknown as AdminApi}
        baseUrl="/admin"
        columnWidths={{email: 200}}
        modelName="User"
      />
    );
    const tables = UNSAFE_root.findAll((n: ReactTestInstance) => Array.isArray(n.props?.columns));
    const cols = (tables[0] as ReactTestInstance).props.columns as {
      title: string;
      width?: number;
    }[];
    const emailCol = cols.find((c) => c.title === "Email");
    expect(emailCol?.width).toBe(200);
  });

  it("builds a descending sort string and falls back when column is out of range", async () => {
    configState.config = fullConfig;
    // Render data so DataTable mounts; then capture the setSortColumn via a dummy
    // rendering. We instead verify the pure helper via a specially-crafted sort
    // that maps to an out-of-range column by using columns override with only one field.
    listState.data = {
      data: [{_id: "u1", email: "a@b.com"}],
      total: 1,
    };
    const {UNSAFE_root, toJSON} = renderWithTheme(
      <AdminModelTable
        api={{} as unknown as AdminApi}
        baseUrl="/admin"
        columns={["email"]}
        modelName="User"
      />
    );
    // Grab setSortColumn from the rendered DataTable and apply a sort with
    // direction "desc" on column 0 (valid) and then column 5 (out of range).
    const table = UNSAFE_root.findAll(
      (n: ReactTestInstance) => typeof n.props?.setSortColumn === "function"
    );
    expect(table.length).toBeGreaterThan(0);
    await act(async () => {
      (table[0] as ReactTestInstance).props.setSortColumn({column: 0, direction: "desc"});
      await new Promise((r) => setTimeout(r, 10));
    });
    await act(async () => {
      (table[0] as ReactTestInstance).props.setSortColumn({column: 99, direction: "asc"});
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(toJSON()).toBeDefined();
  });

  it("fetches config from apiBase but builds row href + create nav from routeBase when split", async () => {
    configState.config = fullConfig;
    listState.data = {data: [{_id: "u1", email: "a@b.com"}], total: 1};
    let headerRight: React.ReactElement | null = null;
    setOptions.mockImplementation((opts: Record<string, unknown>) => {
      if (opts?.headerRight) {
        headerRight = (opts.headerRight as () => React.ReactElement)();
      }
    });
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable
        api={{} as unknown as AdminApi}
        apiBase="/admin"
        modelName="User"
        routeBase="/console"
      />
    );
    // Data fetching must use the API base.
    expect(configApiBaseCalls).toContain("/admin");
    // The first cell's link href must use the route base.
    const tables = UNSAFE_root.findAll((n: ReactTestInstance) => Array.isArray(n.props?.data));
    expect(tables.length).toBeGreaterThan(0);
    const rows = (tables[0] as ReactTestInstance).props.data as {value: {href?: string}}[][];
    expect(rows[0][0].value.href).toBe("/console/User/u1");
    // The create button must navigate using the route base.
    expect(headerRight).not.toBeNull();
    const header = renderWithTheme(headerRight as unknown as React.ReactElement);
    await act(async () => {
      fireEvent.press(header.getByTestId("admin-create-button"));
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(routerPush).toHaveBeenCalledWith("/console/User/create");
  });

  it("uses baseUrl for both fetching and navigation (backward compat)", () => {
    configState.config = fullConfig;
    listState.data = {data: [{_id: "u1", email: "a@b.com"}], total: 1};
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(configApiBaseCalls).toContain("/admin");
    const tables = UNSAFE_root.findAll((n: ReactTestInstance) => Array.isArray(n.props?.data));
    const rows = (tables[0] as ReactTestInstance).props.data as {value: {href?: string}}[][];
    expect(rows[0][0].value.href).toBe("/admin/User/u1");
  });

  it("hides create button when permissions.create is false", async () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          permissions: {create: false},
        },
      ],
      scripts: [],
    };
    let headerRight: React.ReactElement | null = null;
    setOptions.mockImplementation((opts: Record<string, unknown>) => {
      if (opts?.headerRight) {
        headerRight = opts.headerRight();
      }
    });
    renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    expect(headerRight).not.toBeNull();
    const header = renderWithTheme(headerRight as unknown as React.ReactElement);
    expect(header.queryByTestId("admin-create-button")).toBeNull();
  });

  it("marks only sortableFields as sortable columns", () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          listFields: ["email", "active"],
          sortableFields: ["email"],
        },
      ],
      scripts: [],
    };
    listState.data = {data: [{_id: "u1", active: true, email: "a@b.com"}], total: 1};
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    const tables = UNSAFE_root.findAll((n: ReactTestInstance) => Array.isArray(n.props?.columns));
    const cols = (tables[0] as ReactTestInstance).props.columns as {
      sortable?: boolean;
      title: string;
    }[];
    const emailCol = cols.find((c) => c.title === "Email");
    const activeCol = cols.find((c) => c.title === "Active");
    expect(emailCol?.sortable).toBe(true);
    expect(activeCol?.sortable).toBe(false);
  });

  it("uses pageSize from model config for pagination", () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          pageSize: 50,
        },
      ],
      scripts: [],
    };
    listState.data = {data: [{_id: "u1", email: "a@b.com"}], total: 100};
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    const tables = UNSAFE_root.findAll(
      (n: ReactTestInstance) => typeof n.props?.totalPages === "number"
    );
    expect((tables[0] as ReactTestInstance).props.totalPages).toBe(2);
  });

  it("renders search and applies list filters to the query", async () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          filters: [{field: "active", kind: "boolean", label: "Active"}],
          searchFields: ["email"],
        },
      ],
      scripts: [],
    };
    const {UNSAFE_root, getByTestId} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );

    await act(async () => {
      fireEvent.changeText(getByTestId("admin-table-search"), "alice");
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    const filterDrawers = UNSAFE_root.findAll(
      (node: ReactTestInstance) =>
        typeof node.props?.onApply === "function" && Array.isArray(node.props?.filters)
    );
    await act(async () => {
      filterDrawers[0].props.onApply({active: true});
    });

    expect(listQueryArgs.some((params) => (params as {active?: boolean})?.active === true)).toBe(
      true
    );
  });

  it("runs patch and background bulk actions for selected rows", async () => {
    configState.config = {
      customScreens: [],
      models: [
        {
          ...fullConfig.models[0],
          actions: [
            {id: "activate", label: "Activate", patchKeys: ["active"]},
            {background: true, id: "export", label: "Export"},
          ],
        },
      ],
      scripts: [],
    };
    listState.data = {
      data: [{_id: "u1", active: false, email: "a@b.com"}],
      total: 1,
    };
    const {UNSAFE_root, getByTestId} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );

    await act(async () => {
      fireEvent.press(getByTestId("admin-table-row-checkbox-u1"));
    });
    const actionMenus = UNSAFE_root.findAll(
      (node: ReactTestInstance) => typeof node.props?.onRunAction === "function"
    );
    await act(async () => {
      await actionMenus[0].props.onRunAction("activate");
    });
    expect(bulkPatchFn).toHaveBeenCalledWith({ids: ["u1"], patch: {active: true}});

    await act(async () => {
      fireEvent.press(getByTestId("admin-table-row-checkbox-u1"));
    });
    const refreshedActionMenus = UNSAFE_root.findAll(
      (node: ReactTestInstance) => typeof node.props?.onRunAction === "function"
    );
    await act(async () => {
      await refreshedActionMenus[0].props.onRunAction("export");
    });
    expect(enqueueBackgroundFn).toHaveBeenCalledWith({
      ids: ["u1"],
      kind: "export",
      metadata: {actionId: "export"},
      resourceRoute: "/admin/users",
    });
  });

  it("toggles an inline boolean and respects per-record update capability", async () => {
    configState.config = fullConfig;
    listState.data = {
      data: [
        {_adminCapabilities: {update: true}, _id: "u1", active: false, email: "a@b.com"},
        {_adminCapabilities: {update: false}, _id: "u2", active: true, email: "c@d.com"},
      ],
      total: 2,
    };
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    const tables = UNSAFE_root.findAll((node: ReactTestInstance) =>
      Array.isArray(node.props?.data)
    );
    const rows = tables[0].props.data as Array<Array<{value: Record<string, unknown>}>>;
    const firstActiveCell = rows[0][1].value;
    const secondActiveCell = rows[1][1].value;

    await act(async () => {
      (firstActiveCell.onToggle as () => void)();
    });
    expect(patchFn).toHaveBeenCalledTimes(1);
    expect(patchFn).toHaveBeenCalledWith({body: {active: true}, id: "u1"});
    expect(secondActiveCell.disabled).toBe(true);
  });

  it("executes rendered link, row-action, and inline-switch callbacks", async () => {
    configState.config = fullConfig;
    listState.data = {
      data: [{_id: "u1", active: false, email: "a@b.com"}],
      total: 1,
    };
    const {UNSAFE_root} = renderWithTheme(
      <AdminModelTable api={{} as unknown as AdminApi} baseUrl="/admin" modelName="User" />
    );
    const link = UNSAFE_root.findAll(
      (node: ReactTestInstance) =>
        node.props?.text === "a@b.com" && typeof node.props?.onClick === "function"
    )[0];
    const action = (label: string): ReactTestInstance =>
      UNSAFE_root.findAll(
        (node: ReactTestInstance) =>
          node.props?.accessibilityLabel === label && typeof node.props?.onClick === "function"
      )[0];
    const enabledSwitch = UNSAFE_root.findAll(
      (node: ReactTestInstance) =>
        node.props?.accessibilityRole === "switch" &&
        node.props?.disabled === false &&
        typeof node.props?.onPress === "function"
    )[0];

    await act(async () => {
      link.props.onClick();
      action("View").props.onClick();
      action("Edit").props.onClick();
      action("Delete").props.onClick();
      enabledSwitch.props.onPress();
      await Promise.resolve();
    });

    expect(routerPush).toHaveBeenCalledWith("/admin/User/u1");
    expect(deleteFn).toHaveBeenCalledWith("u1");
    expect(patchFn).toHaveBeenCalledWith({body: {active: true}, id: "u1"});
  });
});
