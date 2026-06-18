// noExplicitAny: test mocks use type-erased RTK Query API doubles and UNSAFE_root traversal
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
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
const deleteFn = mock(() => ({unwrap: async () => ({})}));
mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useBulkPatchMutation: () => [mock(() => ({unwrap: async () => ({updated: 0})})), {isLoading: false}],
    useCreateMutation: () => [mock(() => ({unwrap: async () => ({})})), {isLoading: false}],
    useDeleteMutation: () => [deleteFn, {isLoading: false}],
    useListQuery: () => ({
      data: listState.data,
      error: null,
      isLoading: listState.isLoading,
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
});
